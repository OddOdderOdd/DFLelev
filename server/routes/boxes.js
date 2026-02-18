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

/**
 * GET /api/boxes?category=arkiv
 * List alle boxes i en kategori
 */
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    if (!category || !['arkiv', 'ressourcer'].includes(category)) {
      return res.status(400).json({ fejl: 'Ugyldig kategori' });
    }

    const boxes = await prisma.box.findMany({
      where: { category },
      include: {
        createdBy: {
          select: { id: true, navn: true }
        },
        _count: {
          select: { files: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(boxes);
  } catch (error) {
    console.error('List boxes error:', error);
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
