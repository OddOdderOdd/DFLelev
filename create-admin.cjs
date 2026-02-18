/**
 * create-admin.cjs  ← SCHEMA-KORREKT VERSION
 * DFLelev - Opret admin bruger
 *
 * Kør: node create-admin.cjs
 * Kør med egne værdier: node create-admin.cjs --telefon=12345678 --navn="Dit Navn" --kode=hemmelig
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// --- CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [key, ...val] = a.slice(2).split('=');
      return [key, val.join('=')];
    })
);

const CONFIG = {
  telefon:  args.telefon  || '00000000',
  kode:     args.kode     || 'admin123',
  navn:     args.navn     || 'System Administrator',
  aargang:  args.aargang  || '2020',
  kollegie: args.kollegie || 'DFL',
};

// --- ID generator (matcher projektets format: "1770727441071_gy2kr") ---
function genererBrugerId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').slice(0, 5);
  return `${timestamp}_${random}`;
}

// --- Kode hash (SHA-256, matcher schema kommentar) ---
function hashKode(kode) {
  return crypto.createHash('sha256').update(kode).digest('hex');
}

// --- Hoved ---
async function main() {
  console.log('\n🔧 DFLelev - Opret Admin Bruger\n');
  console.log('Konfiguration:');
  console.log(`  Telefon:  ${CONFIG.telefon}`);
  console.log(`  Navn:     ${CONFIG.navn}`);
  console.log(`  Aargang:  ${CONFIG.aargang}`);
  console.log(`  Kollegie: ${CONFIG.kollegie}`);
  console.log('');

  // 1. Tjek om bruger allerede findes
  let bruger = await prisma.user.findUnique({
    where: { telefon: CONFIG.telefon },
    include: { myndigheder: true },
  });

  if (bruger) {
    console.log(`⚠️  Bruger med telefon ${CONFIG.telefon} findes allerede.`);
    console.log(`   Navn: ${bruger.navn}`);
    console.log(`   ID:   ${bruger.id}`);

    // Sørg for at brugeren er aktiv og godkendt
    if (!bruger.aktiv || bruger.afventerGodkendelse) {
      await prisma.user.update({
        where: { id: bruger.id },
        data: {
          aktiv:               true,
          afventerGodkendelse: false,
          godkendtDato:        new Date(),
        },
      });
      console.log('   ✅ Bruger aktiveret og godkendt');
    }

    // Tjek admin rolle (felt hedder "rolle" ikke "myndighed")
    const harAdmin = bruger.myndigheder.some(m => m.rolle === 'Admin');
    if (!harAdmin) {
      console.log('   Brugeren har ikke Admin rolle - tilføjer...');
      await prisma.userAuthority.create({
        data: {
          userId: bruger.id,
          rolle:  'Admin',
        },
      });
      console.log('   ✅ Admin rolle tilføjet!');
    } else {
      console.log('   ✅ Brugeren er allerede Admin. Intet at gøre.');
    }

  } else {
    // 2. Opret ny bruger
    const id       = genererBrugerId();
    const kodeHash = hashKode(CONFIG.kode);

    console.log(`🔑 Genereret ID: ${id}`);
    console.log('🔐 Kode hashet (SHA-256)');

    bruger = await prisma.user.create({
      data: {
        id:                  id,
        navn:                CONFIG.navn,
        telefon:             CONFIG.telefon,
        kodeHash:            kodeHash,
        aargang:             CONFIG.aargang,
        kollegie:            CONFIG.kollegie,
        aktiv:               true,
        afventerGodkendelse: false,
        godkendtDato:        new Date(),
      },
    });

    console.log(`✅ Bruger oprettet! ID: ${bruger.id}`);

    // 3. Tilføj Admin rolle
    await prisma.userAuthority.create({
      data: {
        userId: bruger.id,
        rolle:  'Admin',
      },
    });
    console.log('✅ Admin rolle tilføjet!');

    // 4. Log aktivitet
    await prisma.activityLog.create({
      data: {
        userId:   bruger.id,
        handling: 'OPRET_ADMIN',
        detaljer: JSON.stringify({ kilde: 'create-admin script' }),
      },
    });
    console.log('✅ Aktivitet logget');
  }

  // --- Resultat ---
  console.log('\n🎉 Admin bruger klar!\n');
  console.log('╔══════════════════════════════╗');
  console.log('║       LOGIN OPLYSNINGER      ║');
  console.log('╠══════════════════════════════╣');
  console.log(`║  Telefon:  ${CONFIG.telefon.padEnd(18)}║`);
  console.log(`║  Kode:     ${CONFIG.kode.padEnd(18)}║`);
  console.log(`║  ID:       ${bruger.id.slice(0, 18).padEnd(18)}║`);
  console.log('╚══════════════════════════════╝\n');
}

main()
  .catch(e => {
    console.error('\n❌ Fejl:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
