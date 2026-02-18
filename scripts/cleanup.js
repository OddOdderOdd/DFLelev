import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_UPLOAD = path.join(__dirname, '../server/temp-uploads');

console.log('🧹 DFLelev Cleanup Script');
console.log('========================\n');

// Clean temp uploads
function cleanupTempUploads() {
  if (!fs.existsSync(TEMP_UPLOAD)) {
    console.log('✅ Temp uploads mappe eksisterer ikke');
    return 0;
  }

  const files = fs.readdirSync(TEMP_UPLOAD);
  let cleaned = 0;

  files.forEach(file => {
    const filePath = path.join(TEMP_UPLOAD, file);
    try {
      fs.unlinkSync(filePath);
      cleaned++;
      console.log(`  🗑️ Slettet: ${file}`);
    } catch (error) {
      console.error(`  ❌ Kunne ikke slette ${file}:`, error.message);
    }
  });

  return cleaned;
}

// Clean expired sessions (older than 7 days)
async function cleanupSessions() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.session.deleteMany({
      where: {
        udloeber: {
          lt: new Date()
        }
      }
    });

    console.log(`\n🗑️ Ryddet ${result.count} udløbne sessions`);
    
    await prisma.$disconnect();
    return result.count;
  } catch (error) {
    console.error('❌ Fejl ved session cleanup:', error.message);
    return 0;
  }
}

// Main
async function main() {
  console.log('📂 Rydder temp uploads...');
  const tempCleaned = cleanupTempUploads();
  console.log(`✅ ${tempCleaned} temp filer slettet\n`);

  console.log('🔐 Rydder udløbne sessions...');
  const sessionsCleaned = await cleanupSessions();
  
  console.log('\n✅ Cleanup færdig!');
  console.log(`   - Temp filer: ${tempCleaned}`);
  console.log(`   - Sessions: ${sessionsCleaned}`);
}

main().catch(console.error);
