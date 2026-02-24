import express from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { ARKIV_PATH, RESSOURCER_PATH } from '../index.js';

const router = express.Router();

// Helper: Get base path
function getBasePath(category) {
  return category === 'arkiv' ? ARKIV_PATH : RESSOURCER_PATH;
}

// Helper: Generate box ID
function generateBoxId(title) {
  const timestamp = Date.now();
  const slug = title.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);
  return `${slug}-${timestamp}`;
}

async function syncBoxPermissionEntry(box) {
  const payload = {
    rights: [],
    __meta: {
      kind: 'box',
      parentRole: null,
      canManageUnderRole: false,
      scopeKind: box.category,
      boxId: box.id,
      objectType: 'box',
    }
  };

  await prisma.permission.upsert({
    where: { rolle: `box:${box.id}` },
    update: { rettigheder: JSON.stringify(payload) },
    create: { rolle: `box:${box.id}`, rettigheder: JSON.stringify(payload) }
  });
}

/**
 * GET /api/boxes?category=arkiv
 * List alle boxes i en kategori
 */
router.get('/', async (req, res) => {
  try {
    const { category, q } = req.query;

    if (!category || !['arkiv', 'ressourcer'].includes(category)) {
      return res.status(400).json({ fejl: 'Ugyldig kategori' });
    }

    const search = String(q || '').trim();

    const boxes = await prisma.box.findMany({
      where: { category },
      include: {
        createdBy: {
          select: { id: true, navn: true }
        },
        _count: {
          select: {
            files: true,
            folders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const boxIds = boxes.map((box) => box.id);
    const [folderCounts, fileStats] = await Promise.all([
      prisma.folder.groupBy({ by: ['boxId'], where: { boxId: { in: boxIds } }, _count: { _all: true } }),
      prisma.file.groupBy({ by: ['boxId'], where: { boxId: { in: boxIds } }, _count: { _all: true }, _sum: { stoerrelse: true } })
    ]);

    const folderCountMap = new Map(folderCounts.map((item) => [item.boxId, item._count?._all ?? 0]));
    const fileCountMap = new Map(fileStats.map((item) => [item.boxId, item._count?._all ?? 0]));
    const bytesMap = new Map(fileStats.map((item) => [item.boxId, Number(item._sum?.stoerrelse ?? 0)]));

    const enrichedBoxes = boxes.map((box) => ({
      ...box,
      stats: {
        folderCount: folderCountMap.get(box.id) ?? 0,
        fileCount: fileCountMap.get(box.id) ?? 0,
        totalBytes: bytesMap.get(box.id) ?? 0,
      }
    }));

    if (!search) return res.json(enrichedBoxes);

    const [matchingFolders, matchingFiles] = await Promise.all([
      prisma.folder.findMany({
        where: {
          boxId: { in: boxIds },
          OR: [{ navn: { contains: search } }, { titel: { contains: search } }, { sti: { contains: search } }]
        },
        select: { boxId: true }
      }),
      prisma.file.findMany({
        where: {
          boxId: { in: boxIds },
          OR: [{ filnavn: { contains: search } }, { titel: { contains: search } }, { sti: { contains: search } }]
        },
        select: { boxId: true }
      })
    ]);

    const matchingFolderBoxIds = new Set(matchingFolders.map((item) => item.boxId));
    const matchingFileBoxIds = new Set(matchingFiles.map((item) => item.boxId));
    const needle = search.toLowerCase();

    res.json(
      enrichedBoxes.filter((box) =>
        (box.titel || '').toLowerCase().includes(needle) ||
        (box.beskrivelse || '').toLowerCase().includes(needle) ||
        matchingFolderBoxIds.has(box.id) ||
        matchingFileBoxIds.has(box.id)
      )
    );
  } catch (error) {
    console.error('List boxes error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/boxes/summary?category=arkiv
 * Aggregeret statistik for en kategori (bruges til "Mere info" på forsiden)
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { category } = req.query;

    if (!category || !['arkiv', 'ressourcer'].includes(category)) {
      return res.status(400).json({ fejl: 'Ugyldig kategori' });
    }

    const [boxCount, folderCount, fileAgg] = await Promise.all([
      prisma.box.count({ where: { category } }),
      prisma.folder.count({ where: { box: { category } } }),
      prisma.file.aggregate({
        where: { box: { category } },
        _count: { _all: true },
        _sum: { stoerrelse: true }
      })
    ]);

    res.json({
      category,
      boxCount,
      folderCount,
      fileCount: fileAgg._count?._all ?? 0,
      totalBytes: Number(fileAgg._sum?.stoerrelse ?? 0n)
    });
  } catch (error) {
    console.error('Boxes summary error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/boxes/:id
 * Hent én box
 */
router.get('/:id', async (req, res) => {
  try {
    const box = await prisma.box.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { id: true, navn: true }
        },
        files: true,
        folders: true
      }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    res.json(box);
  } catch (error) {
    console.error('Get box error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/boxes
 * Opret ny box
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { category, titel, beskrivelse, farve, billede } = req.body;

    if (!category || !['arkiv', 'ressourcer'].includes(category)) {
      return res.status(400).json({ fejl: 'Ugyldig kategori' });
    }

    if (!titel?.trim()) {
      return res.status(400).json({ fejl: 'Titel er påkrævet' });
    }

    // Generate ID and create physical folder
    const boxId = generateBoxId(titel);
    const basePath = getBasePath(category);
    const fysiskSti = path.join(basePath, boxId);

    // Create physical directory
    if (!fs.existsSync(fysiskSti)) {
      fs.mkdirSync(fysiskSti, { recursive: true });
    }

    // Create box in database
    const box = await prisma.box.create({
      data: {
        id: boxId,
        category,
        titel: titel.trim(),
        beskrivelse: beskrivelse || '',
        farve: farve || '#3b82f6',
        billede: billede || '',
        fysiskSti: boxId,
        createdById: req.user.id
      },
      include: {
        createdBy: {
          select: { id: true, navn: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'OPRET_BOX',
        detaljer: JSON.stringify({ 
          boxId: box.id, 
          titel: box.titel,
          category 
        })
      }
    });

    console.log(`📦 Box oprettet: ${category}/${boxId}`);

    await syncBoxPermissionEntry(box);

    res.status(201).json(box);
  } catch (error) {
    console.error('Create box error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/boxes/:id
 * Opdater box metadata
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { titel, beskrivelse, farve, billede } = req.body;

    const box = await prisma.box.findUnique({
      where: { id: req.params.id }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    // Update box
    const updated = await prisma.box.update({
      where: { id: req.params.id },
      data: {
        titel: titel !== undefined ? titel : box.titel,
        beskrivelse: beskrivelse !== undefined ? beskrivelse : box.beskrivelse,
        farve: farve !== undefined ? farve : box.farve,
        billede: billede !== undefined ? billede : box.billede,
      },
      include: {
        createdBy: {
          select: { id: true, navn: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'OPDATER_BOX',
        detaljer: JSON.stringify({ 
          boxId: box.id, 
          changes: { titel, beskrivelse, farve, billede }
        })
      }
    });

    console.log(`✏️ Box opdateret: ${updated.category}/${updated.id}`);

    await syncBoxPermissionEntry(updated);

    res.json(updated);
  } catch (error) {
    console.error('Update box error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * DELETE /api/boxes/:id
 * Slet box (inkl. alle filer)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const box = await prisma.box.findUnique({
      where: { id: req.params.id }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    // Delete physical folder
    const basePath = getBasePath(box.category);
    const fysiskSti = path.join(basePath, box.fysiskSti);

    if (fs.existsSync(fysiskSti)) {
      fs.rmSync(fysiskSti, { recursive: true, force: true });
      console.log(`🗑️ Slettet fysisk mappe: ${fysiskSti}`);
    }

    // Delete from database (cascade deletes files and folders)
    await prisma.box.delete({
      where: { id: req.params.id }
    });

    await prisma.permission.deleteMany({ where: { rolle: `box:${box.id}` } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'SLET_BOX',
        detaljer: JSON.stringify({ 
          boxId: box.id, 
          titel: box.titel,
          category: box.category 
        })
      }
    });

    console.log(`🗑️ Box slettet: ${box.category}/${box.id}`);

    res.json({ success: true, besked: 'Box slettet' });
  } catch (error) {
    console.error('Delete box error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

export default router;
