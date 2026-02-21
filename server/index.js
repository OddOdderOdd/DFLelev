import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth.js';
import boxRoutes from './routes/boxes.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const app = express();
const PORT = 3001;

// ═══════════════════════════════════════════════════════════════
// STORAGE CONFIGURATION - FILESYSTEM ROOT VIA ENV
// ═══════════════════════════════════════════════════════════════

const NAS_ROOT = process.env.DFLELEV_STORAGE_ROOT || path.resolve(process.cwd(), 'storage');
const FYSISKE_FILER = path.join(NAS_ROOT, 'Fysiske filer');
const ARKIV_PATH = path.join(FYSISKE_FILER, 'Arkiv');
const RESSOURCER_PATH = path.join(FYSISKE_FILER, 'Ressourcer');
const DB_DIR = path.join(NAS_ROOT, 'database');

// Check if storage path exists
const IS_NAS_AVAILABLE = fs.existsSync(NAS_ROOT);

if (!IS_NAS_AVAILABLE) {
  console.error('❌ FEJL: Storage path ikke tilgængelig!');
  console.error(`   Forventet sti: ${NAS_ROOT}`);
  console.error('   Systemet kan ikke køre uden en gyldig storage-sti.');
  console.error('\n💡 Løsninger:');
  console.error(`   1. Sæt DFLELEV_STORAGE_ROOT korrekt (nu: ${NAS_ROOT})`);
  console.error('   2. Opret placeholder mappe:');
  console.error('      mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/database"');
  console.error('      mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/Fysiske filer/Arkiv"');
  console.error('      mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/Fysiske filer/Ressourcer"');
  process.exit(1);
}

// Export for routes
export { NAS_ROOT, ARKIV_PATH, RESSOURCER_PATH, IS_NAS_AVAILABLE };

// Ensure directory structure exists
console.log('📁 Tjekker mappestruktur...');

const requiredDirs = [
  { path: NAS_ROOT, name: 'Storage root' },
  { path: DB_DIR, name: 'Database' },
  { path: FYSISKE_FILER, name: 'Fysiske filer' },
  { path: ARKIV_PATH, name: 'Arkiv' },
  { path: RESSOURCER_PATH, name: 'Ressourcer' }
];

requiredDirs.forEach(({ path: dirPath, name }) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`   ✅ Oprettet: ${name} (${dirPath})`);
  } else {
    console.log(`   ✓ ${name} findes`);
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      database: 'connected',
      storage: 'filesystem',
      nasRoot: NAS_ROOT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Storage status endpoint
app.get('/api/nas-status', (req, res) => {
  res.json({
    online: true,
    nasRoot: NAS_ROOT,
    fysiskeFiler: FYSISKE_FILER,
    arkivPath: ARKIV_PATH,
    ressourcerPath: RESSOURCER_PATH
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 DFLelev Server v2.0 kører på http://localhost:${PORT}`);
  console.log(`💾 Storage: Filesystem`);
  console.log(`📂 Root: ${NAS_ROOT}`);
  console.log(`   📁 Fysiske filer: ${FYSISKE_FILER}`);
  console.log(`   📦 Arkiv: ${ARKIV_PATH}`);
  console.log(`   📦 Ressourcer: ${RESSOURCER_PATH}`);
  console.log(`   🗄️  Database: ${DB_DIR}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   - POST /api/auth/opret`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/health`);
  console.log(`   - GET  /api/nas-status`);
  console.log(`   - GET  /api/boxes?category=arkiv`);
  console.log(`   - POST /api/files/upload`);
  console.log(`\n✅ Server klar til brug!\n`);
});
