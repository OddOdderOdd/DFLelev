import express from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper: Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'dfl_salt_2025').digest('hex');
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
    const { navn, email, kode, gentag_kode, aargang, kollegie, kollegie_andet, myndigheder, note } = req.body;

    // Validation
    if (!navn?.trim()) return res.status(400).json({ fejl: 'Navn er påkrævet' });
    if (!email?.trim()) return res.status(400).json({ fejl: 'E-mail er påkrævet' });
    if (!isValidEmail(email)) return res.status(400).json({ fejl: 'Ugyldig e-mail' });
    if (!kode) return res.status(400).json({ fejl: 'Kode er påkrævet' });
    if (kode !== gentag_kode) return res.status(400).json({ fejl: 'Koderne matcher ikke' });
    if (kode.length < 6) return res.status(400).json({ fejl: 'Koden skal være mindst 6 tegn' });

    // Check if phone already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });

    if (existing) {
      return res.status(409).json({ fejl: 'Denne e-mail er allerede registreret' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        id: generateUserId(),
        navn: navn.trim(),
        email: normalizeEmail(email),
        kodeHash: hashPassword(kode),
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
    if (user.kodeHash !== hashPassword(kode)) {
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
router.put('/profil-anmodning', requireAuth, async (req, res) => {
  try {
    const { tekst } = req.body;
    if (!tekst?.trim()) return res.status(400).json({ fejl: 'Tom anmodning' });

    await logActivity(req.user.id, 'PROFIL_AENDRING_ANMODNING', { tekst: tekst.trim() });
    await raiseRedFlag(req.user.id, 'Profilændring kræver godkendelse', { tekst: tekst.trim(), type: 'profil-anmodning' });

    res.json({ besked: 'Anmodning sendt' });
  } catch (error) {
    console.error('Profile request error:', error);
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
    if (!user || user.kodeHash !== hashPassword(nuvaerende)) {
      return res.status(400).json({ fejl: 'Nuværende kode er forkert' });
    }

    await prisma.user.update({ where: { id: req.user.id }, data: { kodeHash: hashPassword(ny) } });
    await logActivity(req.user.id, 'KODE_AENDRET');
    res.json({ besked: 'Kode ændret' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

export default router;
