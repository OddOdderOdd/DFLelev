import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const BCRYPT_ROUNDS = 12;

function legacyHashPassword(password) {
  return crypto.createHash('sha256').update(password + 'dfl_salt_2025').digest('hex');
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, storedHash = '') {
  if (!storedHash) return false;

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compare(password, storedHash);
  }

  return legacyHashPassword(password) === storedHash;
}

// Helper: Generate token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Generate user ID
function generateUserId() {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${Date.now()}_${suffix}`;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function anonymizeIp(ip = '') {
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

// Helper: Log activity
async function logActivity(userId, handling, detaljer = {}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        handling,
        detaljer: JSON.stringify(detaljer),
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Helper: Raise red flag
async function raiseRedFlag(userId, grund, detaljer = {}) {
  try {
    await prisma.redFlag.create({
      data: {
        userId,
        grund,
        detaljer: JSON.stringify(detaljer)
      }
    });
    
    await logActivity(userId, 'RØDT_FLAG', { grund, ...detaljer });
  } catch (error) {
    console.error('Failed to raise red flag:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/opret
 * Opret ny bruger (afventer godkendelse)
 */
router.post('/opret', async (req, res) => {
  try {
    const { navn, kaldenavn, email, telefon, kode, gentag_kode, aargang, kollegie, kollegie_andet, myndigheder, note } = req.body;

    // Validation
    if (!navn?.trim()) return res.status(400).json({ fejl: 'Navn er påkrævet' });
    if (!kaldenavn?.trim()) return res.status(400).json({ fejl: 'Kaldenavn er påkrævet' });
    if (!email?.trim()) return res.status(400).json({ fejl: 'E-mail er påkrævet' });
    if (!isValidEmail(email)) return res.status(400).json({ fejl: 'Ugyldig e-mail' });
    if (!kode) return res.status(400).json({ fejl: 'Kode er påkrævet' });
    if (kode !== gentag_kode) return res.status(400).json({ fejl: 'Koderne matcher ikke' });
    if (kode.length < 6) return res.status(400).json({ fejl: 'Koden skal være mindst 6 tegn' });

    const normalizedEmail = normalizeEmail(email);
    const trimmedKaldenavn = String(kaldenavn).trim();

    const [existingEmail, existingKaldenavn] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { kaldenavn: trimmedKaldenavn } })
    ]);

    if (existingEmail) {
      return res.status(409).json({ fejl: 'Denne e-mail er allerede registreret' });
    }

    if (existingKaldenavn) {
      return res.status(409).json({ fejl: 'Dette kaldenavn er allerede taget' });
    }

    const kodeHash = await hashPassword(kode);

    // Create user
    const user = await prisma.user.create({
      data: {
        id: generateUserId(),
        navn: navn.trim(),
        kaldenavn: trimmedKaldenavn,
        email: normalizedEmail,
        telefon: telefon ? String(telefon).trim() : null,
        kodeHash,
        aargang: aargang || '',
        kollegie: kollegie || '',
        kollegieAndet: kollegie_andet || '',
        note: note || '',
        aktiv: false,
        afventerGodkendelse: true,
        myndigheder: {
          create: (myndigheder || []).map(m => ({
            rolle: m.rolle,
            note: m.note || ''
          }))
        }
      }
    });

    await logActivity(user.id, 'KONTO_ANSOEGNING', { 
      navn: user.navn, 
      email: user.email 
    });

    res.status(201).json({ 
      besked: 'Ansøgning modtaget! Din konto afventer godkendelse.',
      id: user.id 
    });
  } catch (error) {
    console.error('Opret user error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/auth/login
 * Log ind
 */
router.post('/login', async (req, res) => {
  try {
    const { email, kode } = req.body;

    if (!email || !kode) {
      return res.status(400).json({ fejl: 'E-mail og kode er påkrævet' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { myndigheder: true }
    });

    if (!user) {
      return res.status(401).json({ fejl: 'Forkert e-mail eller kode' });
    }

    // Check if pending
    if (user.afventerGodkendelse) {
      return res.status(403).json({ fejl: 'Din konto afventer godkendelse af en administrator' });
    }

    // Check password
    const passwordOk = await verifyPassword(kode, user.kodeHash);
    if (!passwordOk) {
      // Check for brute force (5+ failed attempts in 15 minutes)
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentFails = await prisma.activityLog.count({
        where: {
          userId: user.id,
          handling: 'MISLYKKET_LOGIN',
          tidspunkt: { gte: fifteenMinAgo }
        }
      });

      await logActivity(user.id, 'MISLYKKET_LOGIN', { ipHash: anonymizeIp(req.ip) });

      if (recentFails >= 4) {
        await raiseRedFlag(user.id, '5+ mislykkede loginforsøg på 15 min', { ipHash: anonymizeIp(req.ip) });
      }

      return res.status(401).json({ fejl: 'Forkert e-mail eller kode' });
    }

    // Check if active
    if (!user.aktiv) {
      return res.status(403).json({ fejl: 'Din konto er deaktiveret' });
    }

    if (!user.kodeHash.startsWith('$2')) {
      await prisma.user.update({
        where: { id: user.id },
        data: { kodeHash: await hashPassword(kode) }
      });
    }

    // Create session
    const token = generateToken();
    await prisma.session.create({
      data: {
        token,
        userId: user.id,
        udloeber: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ip: anonymizeIp(req.ip)
      }
    });

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { sidstAktiv: new Date() }
    });

    await logActivity(user.id, 'LOGIN', { ipHash: anonymizeIp(req.ip) });

    // Return user without password
    const { kodeHash, ...safeUser } = user;
    res.json({ token, bruger: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/auth/logout
 * Log ud
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await prisma.session.delete({
      where: { token: req.sessionToken }
    });

    await logActivity(req.user.id, 'LOGOUT');

    res.json({ besked: 'Logget ud' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/auth/mig
 * Hent nuværende bruger
 */
router.get('/mig', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { myndigheder: true }
    });

    const { kodeHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/rettigheder
 * Hent alle rolle-rettigheder
 */
router.get('/rettigheder', async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany();
    
    // Convert to object format: { "Undergrunden": ["kp:log", ...], ... }
    const result = {};
    permissions.forEach(p => {
      result[p.rolle] = JSON.parse(p.rettigheder);
    });

    res.json(result);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/auth/admin/rettigheder
 * Opdater rettigheder (admin only)
 */
router.put('/admin/rettigheder', requireAdmin, async (req, res) => {
  try {
    const data = req.body;

    if (typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ fejl: 'Ugyldig data — forvent objekt' });
    }

    // Delete all existing permissions
    await prisma.permission.deleteMany();

    // Create new permissions
    await Promise.all(
      Object.entries(data).map(([rolle, rettigheder]) =>
        prisma.permission.create({
          data: {
            rolle,
            rettigheder: JSON.stringify(rettigheder)
          }
        })
      )
    );

    await logActivity(req.user.id, 'ADMIN_OPDATER_RETTIGHEDER');

    res.json({ besked: 'Rettigheder gemt', data });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});



/**
 * PUT /api/auth/profil-anmodning
 * Bruger anmoder om profilændring (sendes til verify/log)
 */
router.put('/profil', requireAuth, async (req, res) => {
  try {
    const { navn, kaldenavn, email, telefon } = req.body;

    const current = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!current) return res.status(404).json({ fejl: 'Bruger ikke fundet' });

    const nextEmail = email !== undefined ? normalizeEmail(email) : current.email;
    const nextKaldenavn = kaldenavn !== undefined ? String(kaldenavn).trim() : current.kaldenavn;

    if (!nextKaldenavn) return res.status(400).json({ fejl: 'Kaldenavn er påkrævet' });
    if (!nextEmail || !isValidEmail(nextEmail)) return res.status(400).json({ fejl: 'Ugyldig e-mail' });

    const [existingEmail, existingKaldenavn] = await Promise.all([
      prisma.user.findUnique({ where: { email: nextEmail } }),
      prisma.user.findUnique({ where: { kaldenavn: nextKaldenavn } })
    ]);

    if (existingEmail && existingEmail.id !== req.user.id) {
      return res.status(409).json({ fejl: 'Denne e-mail er allerede registreret' });
    }

    if (existingKaldenavn && existingKaldenavn.id !== req.user.id) {
      return res.status(409).json({ fejl: 'Dette kaldenavn er allerede taget' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        navn: navn !== undefined ? String(navn).trim() : current.navn,
        kaldenavn: nextKaldenavn,
        email: nextEmail,
        telefon: telefon !== undefined ? (telefon ? String(telefon).trim() : null) : current.telefon,
      },
      include: { myndigheder: true }
    });

    await logActivity(req.user.id, 'PROFIL_OPDATERET');

    const { kodeHash, ...safeUser } = updated;
    res.json({ besked: 'Profil opdateret', bruger: safeUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

router.post('/slet-konto', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { sletKontoAnmodetAt: new Date() }
    });

    await logActivity(req.user.id, 'KONTO_SLETNING_ANMODET');
    await raiseRedFlag(req.user.id, 'Konto-sletning anmodet', { type: 'konto-sletning' });

    res.json({
      besked: 'Din konto er markeret til sletning hurtigst muligt. Det kan tage op til 2 måneder pga. sommerferie.'
    });
  } catch (error) {
    console.error('Delete account request error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/auth/skift-kode
 */
router.put('/skift-kode', requireAuth, async (req, res) => {
  try {
    const { nuvaerende, ny, gentag } = req.body;
    if (!nuvaerende || !ny || !gentag) return res.status(400).json({ fejl: 'Udfyld alle felter' });
    if (ny !== gentag) return res.status(400).json({ fejl: 'Nye koder matcher ikke' });
    if (ny.length < 6) return res.status(400).json({ fejl: 'Ny kode er for kort' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await verifyPassword(nuvaerende, user.kodeHash))) {
      return res.status(400).json({ fejl: 'Nuværende kode er forkert' });
    }

    await prisma.user.update({ where: { id: req.user.id }, data: { kodeHash: await hashPassword(ny) } });
    await logActivity(req.user.id, 'KODE_AENDRET');
    res.json({ besked: 'Kode ændret' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

export default router;
