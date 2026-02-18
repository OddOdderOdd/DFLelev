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
    const { navn, telefon, kode, gentag_kode, aargang, kollegie, kollegie_andet, myndigheder, note } = req.body;

    // Validation
    if (!navn?.trim()) return res.status(400).json({ fejl: 'Navn er påkrævet' });
    if (!telefon?.trim()) return res.status(400).json({ fejl: 'Telefonnummer er påkrævet' });
    if (!kode) return res.status(400).json({ fejl: 'Kode er påkrævet' });
    if (kode !== gentag_kode) return res.status(400).json({ fejl: 'Koderne matcher ikke' });
    if (kode.length < 6) return res.status(400).json({ fejl: 'Koden skal være mindst 6 tegn' });

    // Check if phone already exists
    const existing = await prisma.user.findUnique({
      where: { telefon: telefon.trim() }
    });

    if (existing) {
      return res.status(409).json({ fejl: 'Dette telefonnummer er allerede registreret' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        id: generateUserId(),
        navn: navn.trim(),
        telefon: telefon.trim(),
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
      telefon: user.telefon 
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
    const { telefon, kode } = req.body;

    if (!telefon || !kode) {
      return res.status(400).json({ fejl: 'Telefonnummer og kode er påkrævet' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { telefon: telefon.trim() },
      include: { myndigheder: true }
    });

    if (!user) {
      return res.status(401).json({ fejl: 'Forkert telefonnummer eller kode' });
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

      await logActivity(user.id, 'MISLYKKET_LOGIN', { ip: req.ip });

      if (recentFails >= 4) {
        await raiseRedFlag(user.id, '5+ mislykkede loginforsøg på 15 min', { ip: req.ip });
      }

      return res.status(401).json({ fejl: 'Forkert telefonnummer eller kode' });
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
        ip: req.ip
      }
    });

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { sidstAktiv: new Date() }
    });

    await logActivity(user.id, 'LOGIN', { ip: req.ip });

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

export default router;
