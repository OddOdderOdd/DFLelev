/**
 * create-admin.cjs
 * DFLelev - Opret admin bruger
 *
 * Kør: node create-admin.cjs
 * Kør med egne værdier: node create-admin.cjs --email=admin@example.com --navn="Dit Navn" --kode=hemmelig
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [key, ...val] = a.slice(2).split('=');
      return [key, val.join('=')];
    })
);

const CONFIG = {
  email:    (args.email || 'admin@dflelev.local').trim().toLowerCase(),
  kode:     args.kode     || 'admin123',
  navn:     args.navn     || 'System Administrator',
  aargang:  args.aargang  || '2020',
  kollegie: args.kollegie || 'DFL',
};

function genererBrugerId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').slice(0, 5);
  return `${timestamp}_${random}`;
}

function hashKode(kode) {
  return crypto.createHash('sha256').update(kode + 'dfl_salt_2025').digest('hex');
}

async function main() {
  console.log('\n🔧 DFLelev - Opret Admin Bruger\n');
  console.log('Konfiguration:');
  console.log(`  E-mail:   ${CONFIG.email}`);
  console.log(`  Navn:     ${CONFIG.navn}`);
  console.log(`  Aargang:  ${CONFIG.aargang}`);
  console.log(`  Kollegie: ${CONFIG.kollegie}`);
  console.log('');

  let bruger = await prisma.user.findUnique({
    where: { email: CONFIG.email },
    include: { myndigheder: true },
  });

  if (bruger) {
    console.log(`⚠️  Bruger med e-mail ${CONFIG.email} findes allerede.`);

    if (!bruger.aktiv || bruger.afventerGodkendelse) {
      await prisma.user.update({
        where: { id: bruger.id },
        data: {
          aktiv: true,
          afventerGodkendelse: false,
          godkendtDato: new Date(),
        },
      });
      console.log('   ✅ Bruger aktiveret og godkendt');
    }

    const harAdmin = bruger.myndigheder.some(m => m.rolle === 'Admin');
    if (!harAdmin) {
      await prisma.userAuthority.create({
        data: { userId: bruger.id, rolle: 'Admin' },
      });
      console.log('   ✅ Admin rolle tilføjet!');
    } else {
      console.log('   ✅ Brugeren er allerede Admin.');
    }
  } else {
    const id = genererBrugerId();
    const kodeHash = hashKode(CONFIG.kode);

    bruger = await prisma.user.create({
      data: {
        id,
        navn: CONFIG.navn,
        email: CONFIG.email,
        kodeHash,
        aargang: CONFIG.aargang,
        kollegie: CONFIG.kollegie,
        aktiv: true,
        afventerGodkendelse: false,
        godkendtDato: new Date(),
      },
    });

    await prisma.userAuthority.create({
      data: { userId: bruger.id, rolle: 'Admin' },
    });

    await prisma.activityLog.create({
      data: {
        userId: bruger.id,
        handling: 'OPRET_ADMIN',
        detaljer: JSON.stringify({ kilde: 'create-admin script' }),
      },
    });

    console.log('✅ Admin bruger oprettet!');
  }

  console.log('\n🎉 Admin bruger klar!\n');
  console.log(`E-mail: ${CONFIG.email}`);
  console.log(`Kode:  ${CONFIG.kode}`);
  console.log(`ID:    ${bruger.id}`);
}

main()
  .catch(e => {
    console.error('\n❌ Fejl:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
