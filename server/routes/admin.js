import express from 'express';
import { prisma } from '../index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const SYSTEM_ROLLER = ['Admin', 'Owner'];
const RIGHT_CONFIRM_OWN_DELETE = 'admin:bekraeft-slet-egne';

function buildDefaultKaldenavn(navn = '') {
  const parts = String(navn)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return '';

  const first = parts[0].replace(/\s+/g, '');
  const initials = parts
    .slice(1)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return `${first}${initials}.`;
}

async function findUniqueKaldenavn(baseKaldenavn, excludeUserId = null) {
  const base = String(baseKaldenavn || '').trim();
  if (!base) return '';

  let attempt = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { kaldenavn: attempt } });
    if (!existing || existing.id === excludeUserId) return attempt;
    attempt = base.endsWith('.') ? `${base.slice(0, -1)}${counter}.` : `${base}${counter}.`;
    counter += 1;
  }
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

function extractRights(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.rights)) return payload.rights;
  return [];
}

async function userHasRight(userId, right) {
  const authorities = await prisma.userAuthority.findMany({
    where: { userId },
    select: { rolle: true },
  });
  const roles = authorities.map((a) => a.rolle).filter(Boolean);
  if (!roles.length) return false;

  const permissions = await prisma.permission.findMany({
    where: { rolle: { in: roles } },
    select: { rettigheder: true },
  });

  for (const perm of permissions) {
    try {
      const rights = extractRights(JSON.parse(perm.rettigheder));
      if (rights.includes(right)) return true;
    } catch {
      // Ignore malformed rows and continue
    }
  }

  return false;
}

/**
 * GET /api/admin/afventer
 * Hent brugere der afventer godkendelse
 */
router.get('/afventer', requireAdmin, async (req, res) => {
  try {
    const pending = await prisma.user.findMany({
      where: {
        afventerGodkendelse: true,
        aktiv: false
      },
      include: {
        myndigheder: true
      },
      orderBy: { oprettet: 'desc' }
    });

    // Remove password hashes
    const safe = pending.map(({ kodeHash, ...user }) => user);

    await logActivity(req.user.id, 'ADMIN_SE_AFVENTENDE');

    res.json(safe);
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/godkend/:id
 * Godkend en bruger
 */
router.post('/godkend/:id', requireAdmin, async (req, res) => {
  try {
    const { justeret_myndigheder } = req.body;

    const bruger = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { myndigheder: true }
    });

    if (!bruger) {
      return res.status(404).json({ fejl: 'Ansøgning ikke fundet' });
    }

    // Update user
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        aktiv: true,
        afventerGodkendelse: false,
        godkendtAfId: req.user.id,
        godkendtDato: new Date()
      },
      include: { myndigheder: true }
    });

    // Update authorities if provided
    if (justeret_myndigheder && Array.isArray(justeret_myndigheder)) {
      // Delete existing authorities
      await prisma.userAuthority.deleteMany({
        where: { userId: req.params.id }
      });

      // Create new authorities
      await prisma.userAuthority.createMany({
        data: justeret_myndigheder.map(m => ({
          userId: req.params.id,
          rolle: m.rolle,
          note: m.note || ''
        }))
      });
    }

    // Log activities
    await logActivity(updated.id, 'KONTO_GODKENDT', { 
      godkendt_af: req.user.navn 
    });
    await logActivity(req.user.id, 'ADMIN_GODKENDT_KONTO', { 
      bruger_id: updated.id, 
      bruger_navn: updated.navn 
    });

    res.json({ 
      besked: `Konto for ${updated.navn} er godkendt`,
      bruger: updated
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/afvis/:id
 * Afvis en bruger ansøgning
 */
router.post('/afvis/:id', requireAdmin, async (req, res) => {
  try {
    const bruger = await prisma.user.findUnique({
      where: { id: req.params.id }
    });

    if (!bruger) {
      return res.status(404).json({ fejl: 'Ansøgning ikke fundet' });
    }

    // Delete user completely
    await prisma.user.delete({
      where: { id: req.params.id }
    });

    await logActivity(req.user.id, 'ADMIN_AFVIST_KONTO', { 
      bruger_id: req.params.id, 
      bruger_navn: bruger.navn 
    });

    res.json({ besked: `Ansøgning fra ${bruger.navn} afvist` });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/admin/brugere
 * Hent alle brugere (inkl. inaktive)
 */
router.get('/brugere', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        myndigheder: true,
        _count: {
          select: { 
            uploadedFiles: true,
            activityLogs: true,
            redFlags: { where: { resolved: false } }
          }
        }
      },
      orderBy: { oprettet: 'desc' }
    });

    // Remove password hashes
    const safe = users.map(({ kodeHash, ...user }) => user);

    await logActivity(req.user.id, 'ADMIN_SE_BRUGERE');

    res.json(safe);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/admin/bruger/:id
 * Rediger bruger
 */
router.put('/bruger/:id', requireAdmin, async (req, res) => {
  try {
    const { myndigheder, kollegie, aargang, note, aktiv, navn, kaldenavn, email } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });

    if (!user) {
      return res.status(404).json({ fejl: 'Bruger ikke fundet' });
    }

    const nextName = navn !== undefined ? String(navn).trim() : user.navn;
    const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : user.email;
    const requestedKaldenavn = kaldenavn !== undefined ? String(kaldenavn).trim() : user.kaldenavn;
    const nextKaldenavn = await findUniqueKaldenavn(requestedKaldenavn || buildDefaultKaldenavn(nextName), user.id);

    if (!nextKaldenavn) return res.status(400).json({ fejl: 'Kaldenavn kunne ikke udledes fra navnet' });

    const [emailOwner] = await Promise.all([
      prisma.user.findUnique({ where: { email: nextEmail } }),
    ]);

    if (emailOwner && emailOwner.id !== user.id) {
      return res.status(409).json({ fejl: 'Denne e-mail er allerede registreret' });
    }

    // Update user
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        kollegie: kollegie !== undefined ? kollegie : user.kollegie,
        aargang: aargang !== undefined ? aargang : user.aargang,
        note: note !== undefined ? note : user.note,
        aktiv: aktiv !== undefined ? aktiv : user.aktiv,
        navn: nextName,
        kaldenavn: nextKaldenavn,
        email: nextEmail
      }
    });

    // Update authorities if provided
    if (myndigheder && Array.isArray(myndigheder)) {
      // Delete existing
      await prisma.userAuthority.deleteMany({
        where: { userId: req.params.id }
      });

      // Create new
      await prisma.userAuthority.createMany({
        data: myndigheder.map(m => ({
          userId: req.params.id,
          rolle: m.rolle,
          note: m.note || ''
        }))
      });
    }

    await logActivity(req.user.id, 'ADMIN_REDIGERET_BRUGER', { 
      bruger_id: req.params.id 
    });

    const { kodeHash, ...safe } = updated;
    res.json(safe);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/admin/log/:userId
 * Hent activity log for bruger
 */
router.get('/log/:userId', requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { userId: req.params.userId },
      orderBy: { tidspunkt: 'desc' },
      take: 100 // Last 100 entries
    });

    await logActivity(req.user.id, 'ADMIN_SE_LOG', { 
      log_for: req.params.userId 
    });

    res.json(logs);
  } catch (error) {
    console.error('Get log error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/admin/roedt-flag
 * Hent alle røde flag
 */
router.get('/roedt-flag', requireAdmin, async (req, res) => {
  try {
    const flags = await prisma.redFlag.findMany({
      where: { resolved: false },
      include: {
        user: {
          select: { id: true, navn: true, email: true }
        }
      },
      orderBy: { tidspunkt: 'desc' }
    });

    await logActivity(req.user.id, 'ADMIN_SE_ROEDT_FLAG');

    res.json(flags);
  } catch (error) {
    console.error('Get red flags error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/admin/roedt-flag/:id/resolve
 * Marker rødt flag som løst
 */
router.put('/roedt-flag/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const flag = await prisma.redFlag.update({
      where: { id: req.params.id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.id
      },
      include: {
        user: {
          select: { id: true, navn: true }
        }
      }
    });

    await logActivity(req.user.id, 'ADMIN_LOESTE_ROEDT_FLAG', { 
      flag_id: req.params.id,
      userId: flag.userId 
    });

    res.json(flag);
  } catch (error) {
    console.error('Resolve flag error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});



/**
 * GET /api/admin/log/roller
 * Log for brugere med mindst én rolle/myndighed
 */
router.get('/log/roller', requireAdmin, async (req, res) => {
  try {
    const rolleBrugere = await prisma.userAuthority.findMany({
      select: { userId: true },
      distinct: ['userId']
    });
    const ids = rolleBrugere.map(r => r.userId);

    const logs = await prisma.activityLog.findMany({
      where: { userId: { in: ids } },
      include: { user: { select: { navn: true } } },
      orderBy: { tidspunkt: 'desc' },
      take: 200,
    });

    res.json(logs);
  } catch (error) {
    console.error('Get role logs error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});
/**
 * GET /api/admin/stats
 * Hent system statistik
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      totalBoxes,
      totalFiles,
      unresolvedFlags,
      recentLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { aktiv: true } }),
      prisma.user.count({ where: { afventerGodkendelse: true } }),
      prisma.box.count(),
      prisma.file.count(),
      prisma.redFlag.count({ where: { resolved: false } }),
      prisma.activityLog.findMany({
        orderBy: { tidspunkt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { navn: true }
          }
        }
      })
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        pending: pendingUsers
      },
      content: {
        boxes: totalBoxes,
        files: totalFiles
      },
      security: {
        unresolvedFlags
      },
      recentActivity: recentLogs
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});


/**
 * GET /api/admin/rettigheder
 * Hent rå rolle-konfiguration inkl. ansvarlige
 */
router.get('/rettigheder', requireAdmin, async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany();
    const result = {};
    permissions.forEach((p) => {
      result[p.rolle] = JSON.parse(p.rettigheder);
    });
    res.json(result);
  } catch (error) {
    console.error('Get raw permissions error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROLLE-MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/roller
 * Hent alle aktive roller (ekskl. Admin/Owner systemroller)
 */
router.get('/roller', requireAdmin, async (req, res) => {
  try {
    const roller = await prisma.rolle.findMany({
      where: { slettet: false },
      orderBy: { navn: 'asc' },
    });
    res.json(roller);
  } catch (error) {
    console.error('Get roller error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/admin/roller/alle
 * Hent alle roller inkl. soft-slettede (til rollback)
 */
router.get('/roller/alle', requireAdmin, async (req, res) => {
  try {
    const roller = await prisma.rolle.findMany({
      orderBy: [{ slettet: 'asc' }, { navn: 'asc' }],
    });
    res.json(roller);
  } catch (error) {
    console.error('Get alle roller error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller/sync
 * Synkroniser roller fra UserAuthority til Rolle-tabellen.
 * Kaldes automatisk når en bruger tildeles en ny rolle.
 */
router.post('/roller/sync', requireAdmin, async (req, res) => {
  try {
    // Hent alle unikke roller fra UserAuthority, ekskl. systemroller
    const authorities = await prisma.userAuthority.findMany({
      select: { rolle: true },
      distinct: ['rolle'],
    });

    const nyeRoller = authorities
      .map(a => a.rolle)
      .filter(r => !SYSTEM_ROLLER.includes(r));

    let oprettet = 0;
    for (const navn of nyeRoller) {
      const eksisterer = await prisma.rolle.findUnique({ where: { navn } });
      if (!eksisterer) {
        await prisma.rolle.create({
          data: { navn, oprettetAfId: req.user.id },
        });
        oprettet++;
      }
    }

    await logActivity(req.user.id, 'ADMIN_SYNC_ROLLER', { oprettet });
    res.json({ besked: `Synkroniseret. ${oprettet} nye roller oprettet.`, oprettet });
  } catch (error) {
    console.error('Sync roller error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller
 * Opret en ny rolle manuelt
 */
router.post('/roller', requireAdmin, async (req, res) => {
  try {
    const { navn } = req.body;
    if (!navn?.trim()) return res.status(400).json({ fejl: 'Navn kræves' });
    if (SYSTEM_ROLLER.includes(navn.trim())) {
      return res.status(400).json({ fejl: 'Admin og Owner er systemroller og kan ikke oprettes manuelt' });
    }

    const rolle = await prisma.rolle.upsert({
      where: { navn: navn.trim() },
      update: { slettet: false, slettetDato: null, slettetAfId: null, sletAnmodetAf: null, sletAnmodetAt: null, sletBekraeftet: false },
      create: { navn: navn.trim(), oprettetAfId: req.user.id },
    });

    await logActivity(req.user.id, 'ADMIN_OPRET_ROLLE', { rolle: navn.trim() });
    res.status(201).json(rolle);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ fejl: 'En rolle med dette navn eksisterer allerede' });
    console.error('Opret rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/admin/roller/:id/omdoeb
 * Omdøb rolle — opdaterer navn i Rolle og UserAuthority overalt
 */
router.put('/roller/:rolleNavn/omdoeb', requireAdmin, async (req, res) => {
  try {
    const { nytNavn } = req.body;
    if (!nytNavn?.trim()) return res.status(400).json({ fejl: 'Nyt navn kræves' });
    if (SYSTEM_ROLLER.includes(nytNavn.trim())) {
      return res.status(400).json({ fejl: 'Kan ikke omdøbe til en systemrolle' });
    }

    const rolle = await prisma.rolle.findUnique({ where: { navn: req.params.rolleNavn } });
    if (!rolle || rolle.slettet) return res.status(404).json({ fejl: 'Rolle ikke fundet' });

    const gammeltNavn = rolle.navn;

    // Opdater Rolle-tabel
    const opdateret = await prisma.rolle.update({
      where: { navn: req.params.rolleNavn },
      data: { navn: nytNavn.trim() },
    });

    // Opdater alle UserAuthority med det gamle navn
    const { count } = await prisma.userAuthority.updateMany({
      where: { rolle: gammeltNavn },
      data: { rolle: nytNavn.trim() },
    });

    // Opdater Permission-tabel hvis nøglen matcher
    const perm = await prisma.permission.findUnique({ where: { rolle: gammeltNavn } });
    if (perm) {
      await prisma.permission.update({
        where: { rolle: gammeltNavn },
        data: { rolle: nytNavn.trim() },
      });
    }

    await logActivity(req.user.id, 'ADMIN_OMDOEB_ROLLE', {
      fra: gammeltNavn,
      til: nytNavn.trim(),
      paavirkedebrugere: count,
    });

    res.json({ rolle: opdateret, paavirkedebrugere: count });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ fejl: 'En rolle med dette navn eksisterer allerede' });
    console.error('Omdøb rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller/:id/anmod-slet
 * Direkte soft-delete af rolle (ingen ekstra godkendelse)
 */
router.post('/roller/:rolleNavn/anmod-slet', requireAdmin, async (req, res) => {
  try {
    const rolle = await prisma.rolle.findUnique({ where: { navn: req.params.rolleNavn } });
    if (!rolle || rolle.slettet) return res.status(404).json({ fejl: 'Rolle ikke fundet' });

    const opdateret = await prisma.rolle.update({
      where: { navn: req.params.rolleNavn },
      data: {
        slettet: true,
        slettetDato: new Date(),
        slettetAfId: req.user.id,
        sletAnmodetAf: req.user.id,
        sletAnmodetAt: new Date(),
        sletBekraeftet: true,
      },
    });

    await logActivity(req.user.id, 'ADMIN_SLET_ROLLE_DIREKTE', { rolle: rolle.navn });
    res.json({ besked: `Rollen "${rolle.navn}" er slettet (soft-delete).`, rolle: opdateret });
  } catch (error) {
    console.error('Anmod slet rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller/:id/bekraeft-slet
 * Legacy endpoint fra tidligere 2-trins flow
 */
router.post('/roller/:rolleNavn/bekraeft-slet', requireAdmin, async (req, res) => {
  try {
    const rolle = await prisma.rolle.findUnique({ where: { navn: req.params.rolleNavn } });
    if (!rolle || rolle.slettet) return res.status(404).json({ fejl: 'Rolle ikke fundet' });
    if (!rolle.sletAnmodetAf) return res.status(400).json({ fejl: 'Ingen sletnings-anmodning på denne rolle' });
    if (rolle.sletAnmodetAf === req.user.id) {
      const allowed = await userHasRight(req.user.id, RIGHT_CONFIRM_OWN_DELETE);
      if (!allowed) {
        return res.status(403).json({ fejl: 'Du kan ikke bekræfte din egen sletnings-anmodning uden rettigheden "Kan bekræfte slet, sine egne slet".' });
      }
    }

    const opdateret = await prisma.rolle.update({
      where: { navn: req.params.rolleNavn },
      data: {
        slettet: true,
        slettetDato: new Date(),
        slettetAfId: req.user.id,
        sletBekraeftet: true,
      },
    });

    await logActivity(req.user.id, 'ADMIN_BEKRAEFT_SLET_ROLLE', {
      rolle: rolle.navn,
      anmodetAf: rolle.sletAnmodetAf,
    });

    res.json({ besked: `Rollen "${rolle.navn}" er nu slettet (soft-delete). Den kan gendannes af en admin/owner.`, rolle: opdateret });
  } catch (error) {
    console.error('Bekræft slet rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller/:id/annuller-slet
 * Annuller en sletnings-anmodning
 */
router.post('/roller/:id/annuller-slet', requireAdmin, async (req, res) => {
  try {
    const rolle = await prisma.rolle.findUnique({ where: { id: req.params.id } });
    if (!rolle) return res.status(404).json({ fejl: 'Rolle ikke fundet' });

    const opdateret = await prisma.rolle.update({
      where: { id: req.params.id },
      data: { sletAnmodetAf: null, sletAnmodetAt: null, sletBekraeftet: false },
    });

    await logActivity(req.user.id, 'ADMIN_ANNULLER_SLET_ROLLE', { rolle: rolle.navn });
    res.json({ rolle: opdateret });
  } catch (error) {
    console.error('Annuller slet rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/admin/roller/:id/gendan
 * Rollback: gendan en soft-slettet rolle
 */
router.post('/roller/:id/gendan', requireAdmin, async (req, res) => {
  try {
    const rolle = await prisma.rolle.findUnique({ where: { id: req.params.id } });
    if (!rolle) return res.status(404).json({ fejl: 'Rolle ikke fundet' });
    if (!rolle.slettet) return res.status(400).json({ fejl: 'Rollen er ikke slettet' });

    const opdateret = await prisma.rolle.update({
      where: { id: req.params.id },
      data: {
        slettet: false,
        slettetDato: null,
        slettetAfId: null,
        sletAnmodetAf: null,
        sletAnmodetAt: null,
        sletBekraeftet: false,
      },
    });

    await logActivity(req.user.id, 'ADMIN_GENDAN_ROLLE', { rolle: rolle.navn });
    res.json({ besked: `Rollen "${rolle.navn}" er gendannet.`, rolle: opdateret });
  } catch (error) {
    console.error('Gendan rolle error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

export default router;
