/**
 * create-admin.cjs
 * DFLelev - Setup backend + opret første owner-bruger
 *
 * Standard:
 *   node create-admin.cjs
 *
 * Med egne værdier:
 *   node create-admin.cjs --email=owner@example.com --navn="Dit Navn" --kode=hemmelig
 *
 * Nyttige flags:
 *   --skip-install  (spring npm install over)
 *   --skip-start    (spring npm run dev over)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT_DIR = __dirname;
process.chdir(ROOT_DIR);

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, ...val] = a.slice(2).split('=');
      return [key, val.join('=') || true];
    })
);

const CONFIG = {
  email: (args.email || 'admin@dflelev.local').trim().toLowerCase(),
  kode: args.kode || 'admin123',
  navn: args.navn || 'System Owner',
  kaldenavn: args.kaldenavn || '',
  aargang: args.aargang || '2020',
  kollegie: args.kollegie || 'DFL',
  skipInstall: Boolean(args['skip-install']),
  skipStart: Boolean(args['skip-start']),
};

const ALLE_RETTIGHEDER = [
  'side:arkiv',
  'side:ressourcer',
  'side:mindmap',
  'side:skolekort',
  'kp:verify',
  'kp:log',
  'kp:brugere',
  'kp:rettigheder',
  'fil:upload',
  'fil:slet',
  'fil:opret-mappe',
  'admin:bekraeft-slet-egne',
];

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Kommando fejlede: ${cmd} ${cmdArgs.join(' ')}`);
  }
}

function parseEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function ensureEnvFile() {
  const envPath = path.resolve('.env');
  const current = parseEnvFile(envPath);
  const required = {
    DATABASE_URL: 'file:/mnt/koala/DFLelevFiller/database/dflelev.db',
    DFLELEV_STORAGE_ROOT: '/mnt/koala/DFLelevFiller',
  };

  let changed = false;
  Object.entries(required).forEach(([key, value]) => {
    if (!current[key] || !String(current[key]).trim()) {
      current[key] = value;
      changed = true;
    }
  });

  if (!fs.existsSync(envPath) || changed) {
    const lines = Object.entries(current).map(([key, value]) => {
      const safe = String(value).replace(/"/g, '\\"');
      return `${key}="${safe}"`;
    });
    fs.writeFileSync(envPath, `${lines.join('\n')}\n`, 'utf8');
  }

  return current;
}

function ensureStorageStructure() {
  const envFromFile = ensureEnvFile();
  const storageRoot = process.env.DFLELEV_STORAGE_ROOT || envFromFile.DFLELEV_STORAGE_ROOT || '/mnt/koala/DFLelevFiller';
  const root = path.resolve(storageRoot);

  const dirs = [
    path.join(root, 'database'),
    path.join(root, 'Fysiske filer', 'Arkiv'),
    path.join(root, 'Fysiske filer', 'Ressourcer'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return root;
}

function generateUserId() {
  const random = crypto.randomBytes(4).toString('hex').slice(0, 5);
  return `${Date.now()}_${random}`;
}

function buildDefaultKaldenavn(navn = '') {
  const parts = String(navn)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'Owner.';
  const first = parts[0].replace(/\s+/g, '');
  const initials = parts
    .slice(1)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return `${first}${initials}.`;
}

async function findUniqueKaldenavn(prisma, baseKaldenavn, excludeUserId = null) {
  const base = String(baseKaldenavn || '').trim() || 'Owner.';
  let attempt = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.user.findUnique({ where: { kaldenavn: attempt } });
    if (!existing || existing.id === excludeUserId) return attempt;
    attempt = base.endsWith('.') ? `${base.slice(0, -1)}${counter}.` : `${base}${counter}.`;
    counter += 1;
  }
}

async function setupDatabaseAndOwner() {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcrypt');
  const prisma = new PrismaClient();

  try {
    const desiredKaldenavn = CONFIG.kaldenavn || buildDefaultKaldenavn(CONFIG.navn);
    const kodeHash = await bcrypt.hash(CONFIG.kode, 12);
    let bruger = await prisma.user.findUnique({
      where: { email: CONFIG.email },
      include: { myndigheder: true },
    });
    const kaldenavn = await findUniqueKaldenavn(prisma, desiredKaldenavn, bruger?.id || null);

    // Systemroller holdes i backend permission-kataloget.
    await Promise.all(
      ['Admin', 'Owner'].map((rolle) =>
        prisma.permission.upsert({
          where: { rolle },
          update: { rettigheder: JSON.stringify(ALLE_RETTIGHEDER) },
          create: { rolle, rettigheder: JSON.stringify(ALLE_RETTIGHEDER) },
        })
      )
    );

    // Hvis systemroller utilsigtet findes i Rolle-tabellen, fjern dem (de er systemroller).
    await prisma.rolle.deleteMany({ where: { navn: { in: ['Admin', 'Owner'] } } });

    if (bruger) {
      await prisma.user.update({
        where: { id: bruger.id },
        data: {
          navn: CONFIG.navn,
          kaldenavn,
          kodeHash,
          aargang: CONFIG.aargang,
          kollegie: CONFIG.kollegie,
          aktiv: true,
          afventerGodkendelse: false,
          godkendtDato: new Date(),
        },
      });
    } else {
      bruger = await prisma.user.create({
        data: {
          id: generateUserId(),
          navn: CONFIG.navn,
          kaldenavn,
          email: CONFIG.email,
          kodeHash,
          aargang: CONFIG.aargang,
          kollegie: CONFIG.kollegie,
          aktiv: true,
          afventerGodkendelse: false,
          godkendtDato: new Date(),
        },
      });
    }

    // Første bruger skal være Owner (ikke Admin).
    await prisma.userAuthority.upsert({
      where: { userId_rolle: { userId: bruger.id, rolle: 'Owner' } },
      update: {},
      create: { userId: bruger.id, rolle: 'Owner' },
    });
    await prisma.userAuthority.deleteMany({
      where: { userId: bruger.id, rolle: 'Admin' },
    });

    await prisma.activityLog.create({
      data: {
        userId: bruger.id,
        handling: 'BACKEND_SETUP_OWNER',
        detaljer: JSON.stringify({ kilde: 'create-admin setup script' }),
      },
    });

    return bruger;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('\nDFLelev backend setup\n');
  console.log(`Projektmappe: ${ROOT_DIR}`);
  console.log(`E-mail:   ${CONFIG.email}`);
  console.log(`Navn:     ${CONFIG.navn}`);
  console.log(`Aargang:  ${CONFIG.aargang}`);
  console.log(`Kollegie: ${CONFIG.kollegie}\n`);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  if (!CONFIG.skipInstall) {
    console.log('1) Installerer dependencies...');
    run(npmCmd, ['install']);
  } else {
    console.log('1) Springer dependency-installation over (--skip-install)');
  }

  console.log('2) Opretter storage-mapper...');
  const storageRoot = ensureStorageStructure();
  console.log(`   Storage klar: ${storageRoot}`);

  console.log('3) Genererer Prisma client...');
  run(npmCmd, ['run', 'db:generate']);

  console.log('4) Synkroniserer database schema...');
  run(npmCmd, ['run', 'db:push']);

  console.log('5) Opretter systemroller + owner-bruger...');
  const bruger = await setupDatabaseAndOwner();

  console.log('\nSetup færdig.');
  console.log(`Login e-mail: ${CONFIG.email}`);
  console.log(`Login kode:   ${CONFIG.kode}`);
  console.log(`Bruger ID:    ${bruger.id}`);
  console.log('Rolle:        Owner');
  console.log('Systemroller i backend: Admin, Owner\n');

  if (!CONFIG.skipStart) {
    console.log('6) Starter backend + frontend (npm run dev)...\n');
    const child = spawn(npmCmd, ['run', 'dev'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } else {
    console.log('6) Springer opstart over (--skip-start)');
  }
}

main().catch((e) => {
  console.error('\nFejl under setup:', e.message);
  process.exit(1);
});
