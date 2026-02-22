import express from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ARKIV_PATH, RESSOURCER_PATH } from '../index.js';

const router = express.Router();

// Helper: Get base path
function getBasePath(category) {
  return category === 'arkiv' ? ARKIV_PATH : RESSOURCER_PATH;
}

// Helper: Extract display title from filename
function extractTitle(filename) {
  // Remove timestamp prefix: "1770727441071-Test fil.txt" → "Test fil.txt"
  const withoutTimestamp = filename.replace(/^\d+-/, '');
  // Remove extension: "Test fil.txt" → "Test fil"
  return withoutTimestamp.replace(/\.[^/.]+$/, '');
}

// Helper: Get MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}


async function getUserRoles(userId) {
  const authorities = await prisma.userAuthority.findMany({ where: { userId }, select: { rolle: true } });
  return authorities.map((a) => a.rolle);
}

function parentPaths(pathValue = '') {
  if (!pathValue) return [''];
  const parts = pathValue.split('/').filter(Boolean);
  const paths = [''];
  for (let i = 0; i < parts.length; i++) paths.push(parts.slice(0, i + 1).join('/'));
  return paths;
}

async function hasFolderAccess(boxId, userId, targetPath = '', mode = 'view') {
  const roles = await getUserRoles(userId);
  if (roles.includes('Admin') || roles.includes('Owner')) return true;
  if (!roles.length) return false;

  const rules = await prisma.folderAccessRule.findMany({ where: { boxId, folderPath: { in: parentPaths(targetPath) }, rolle: { in: roles } } });
  if (!rules.length) return mode === 'view';
  const allowView = rules.some((r) => r.canView);
  const allowEdit = rules.some((r) => r.canEdit);
  return mode === 'edit' ? allowEdit : allowView;
}

async function ensureFolderAccess(req, res, boxId, targetPath, mode = 'view') {
  const ok = await hasFolderAccess(boxId, req.user.id, targetPath || '', mode);
  if (!ok) {
    res.status(403).json({ fejl: 'Du har ikke adgang til denne mappe' });
    return false;
  }
  return true;
}

// Helper: Scan directory recursively
async function scanDirectory(boxId, dirPath, currentPath = '', boxCategory) {
  const items = { files: [], folders: [] };
  
  if (!fs.existsSync(dirPath)) return items;

  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const relativePath = currentPath ? `${currentPath}/${entry}` : entry;
    
    try {
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        // It's a folder - scan recursively
        const folderMeta = {
          navn: entry,
          titel: entry,
          sti: relativePath,
          createdAt: stats.birthtime
        };

        items.folders.push(folderMeta);

        // Recursive scan
        const subItems = await scanDirectory(boxId, fullPath, relativePath, boxCategory);
        items.files.push(...subItems.files);
        items.folders.push(...subItems.folders);
      } else {
        // It's a file
        const fileMeta = {
          filnavn: entry,
          titel: extractTitle(entry),
          sti: relativePath,
          mimeType: getMimeType(entry),
          stoerrelse: stats.size,
          createdAt: stats.birthtime
        };

        items.files.push(fileMeta);
      }
    } catch (error) {
      console.error(`Error scanning ${entry}:`, error);
    }
  }

  return items;
}

/**
 * POST /api/files/upload
 * Upload filer til en box
 */
router.post('/upload', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const { boxId, currentPath, beskrivelse, tags } = req.body;

    if (!boxId) {
      return res.status(400).json({ fejl: 'boxId er påkrævet' });
    }

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const boxPath = path.join(basePath, box.fysiskSti);
    const targetDir = currentPath ? path.join(boxPath, currentPath) : boxPath;

    if (!(await ensureFolderAccess(req, res, box.id, currentPath || '', 'edit'))) return;

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uploadedFiles = [];

    // Move files from temp to target
    for (const file of req.files) {
      const targetPath = path.join(targetDir, file.filename);
      fs.renameSync(file.path, targetPath);

      const relativePath = currentPath ? `${currentPath}/${file.filename}` : file.filename;

      // Create file record in database
      const fileRecord = await prisma.file.create({
        data: {
          boxId: box.id,
          filnavn: file.filename,
          titel: extractTitle(file.filename),
          beskrivelse: beskrivelse || '',
          sti: relativePath,
          mimeType: getMimeType(file.filename),
          stoerrelse: file.size,
          tags: tags ? JSON.stringify(tags) : null,
          uploadedById: req.user.id
        }
      });

      uploadedFiles.push(fileRecord);

      console.log(`✅ Uploaded: ${box.category}/${boxId}/${relativePath}`);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'UPLOAD_FILER',
        detaljer: JSON.stringify({
          boxId,
          count: uploadedFiles.length,
          files: uploadedFiles.map(f => f.filnavn)
        })
      }
    });

    res.json({
      success: true,
      uploaded: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/files/sync/:boxId
 * Synkroniser database med fysisk filsystem
 */
router.get('/sync/:boxId', requireAuth, async (req, res) => {
  try {
    const { boxId } = req.params;

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const boxPath = path.join(basePath, box.fysiskSti);

    if (!(await ensureFolderAccess(req, res, box.id, '', 'view'))) return;

    // Scan physical directory
    const scanned = await scanDirectory(boxId, boxPath, '', box.category);

    // Get existing files and folders from database
    const existingFiles = await prisma.file.findMany({
      where: { boxId }
    });
    const existingFolders = await prisma.folder.findMany({
      where: { boxId }
    });

    // Sync files: Delete missing, add new
    const scannedFilePaths = new Set(scanned.files.map(f => f.sti));
    const existingFilePaths = new Set(existingFiles.map(f => f.sti));

    // Delete files not on disk
    for (const existing of existingFiles) {
      if (!scannedFilePaths.has(existing.sti)) {
        await prisma.file.delete({ where: { id: existing.id } });
        console.log(`🗑️ Removed missing file from DB: ${existing.sti}`);
      }
    }

    // Add new files
    for (const scannedFile of scanned.files) {
      if (!existingFilePaths.has(scannedFile.sti)) {
        await prisma.file.create({
          data: {
            boxId,
            ...scannedFile
          }
        });
        console.log(`➕ Added new file to DB: ${scannedFile.sti}`);
      }
    }

    // Sync folders similarly
    const scannedFolderPaths = new Set(scanned.folders.map(f => f.sti));
    const existingFolderPaths = new Set(existingFolders.map(f => f.sti));

    // Delete folders not on disk
    for (const existing of existingFolders) {
      if (!scannedFolderPaths.has(existing.sti)) {
        await prisma.folder.delete({ where: { id: existing.id } });
        console.log(`🗑️ Removed missing folder from DB: ${existing.sti}`);
      }
    }

    // Add new folders
    for (const scannedFolder of scanned.folders) {
      if (!existingFolderPaths.has(scannedFolder.sti)) {
        await prisma.folder.create({
          data: {
            boxId,
            ...scannedFolder
          }
        });
        console.log(`➕ Added new folder to DB: ${scannedFolder.sti}`);
      }
    }

    // Get fresh data
    const files = await prisma.file.findMany({
      where: { boxId },
      include: {
        uploadedBy: {
          select: { id: true, navn: true }
        }
      }
    });

    const folders = await prisma.folder.findMany({
      where: { boxId }
    });

    const visibleFiles = [];
    for (const file of files) { if (await hasFolderAccess(boxId, req.user.id, file.sti.includes('/') ? file.sti.split('/').slice(0, -1).join('/') : '', 'view')) visibleFiles.push(file); }
    const visibleFolders = [];
    for (const folder of folders) { if (await hasFolderAccess(boxId, req.user.id, folder.sti, 'view')) visibleFolders.push(folder); }

    console.log(`🔄 Synced ${box.category}/${boxId}: ${visibleFiles.length} files, ${visibleFolders.length} folders`);

    res.json({
      success: true,
      files: visibleFiles,
      folders: visibleFolders
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * GET /api/files/:boxId/*
 * Download/stream en fil
 */
router.get('/:boxId/*', requireAuth, async (req, res) => {
  try {
    const { boxId } = req.params;
    const filePath = req.params[0];

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
    if (!(await ensureFolderAccess(req, res, box.id, folderPath, 'view'))) return;
    const fullPath = path.join(basePath, box.fysiskSti, filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ fejl: 'Fil ikke fundet' });
    }

    // Send file
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * DELETE /api/files/:boxId/*
 * Slet fil eller mappe
 */
router.delete('/:boxId/*', requireAuth, async (req, res) => {
  try {
    const { boxId } = req.params;
    const filePath = req.params[0];

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
    if (!(await ensureFolderAccess(req, res, box.id, folderPath, 'view'))) return;
    const fullPath = path.join(basePath, box.fysiskSti, filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ fejl: 'Fil ikke fundet' });
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      // Delete folder recursively
      fs.rmSync(fullPath, { recursive: true, force: true });

      // Delete folder record and all files in it
      await prisma.folder.deleteMany({
        where: {
          boxId,
          sti: { startsWith: filePath }
        }
      });

      await prisma.file.deleteMany({
        where: {
          boxId,
          sti: { startsWith: filePath }
        }
      });

      console.log(`🗑️ Deleted folder: ${box.category}/${boxId}/${filePath}`);
    } else {
      // Delete file
      fs.unlinkSync(fullPath);

      // Delete file record
      await prisma.file.deleteMany({
        where: {
          boxId,
          sti: filePath
        }
      });

      console.log(`🗑️ Deleted file: ${box.category}/${boxId}/${filePath}`);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'SLET_FIL',
        detaljer: JSON.stringify({
          boxId,
          filePath,
          isDirectory: stats.isDirectory()
        })
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * POST /api/files/create-folder
 * Opret ny mappe
 */
router.post('/create-folder', requireAuth, async (req, res) => {
  try {
    const { boxId, currentPath, folderName, titel, beskrivelse } = req.body;

    if (!boxId || !folderName) {
      return res.status(400).json({ fejl: 'boxId og folderName er påkrævet' });
    }

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const boxPath = path.join(basePath, box.fysiskSti);
    if (!(await ensureFolderAccess(req, res, box.id, currentPath || '', 'edit'))) return;

    const folderPath = currentPath 
      ? path.join(boxPath, currentPath, folderName)
      : path.join(boxPath, folderName);

    // Check if exists
    if (fs.existsSync(folderPath)) {
      return res.status(409).json({ fejl: 'Mappe eksisterer allerede' });
    }

    // Create physical folder
    fs.mkdirSync(folderPath, { recursive: true });

    const relativePath = currentPath ? `${currentPath}/${folderName}` : folderName;

    // Create folder record
    const folder = await prisma.folder.create({
      data: {
        boxId,
        navn: folderName,
        titel: titel || folderName,
        beskrivelse: beskrivelse || '',
        sti: relativePath,
        createdBy: req.user.id
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'OPRET_MAPPE',
        detaljer: JSON.stringify({
          boxId,
          folderName,
          sti: relativePath
        })
      }
    });

    console.log(`📁 Created folder: ${box.category}/${boxId}/${relativePath}`);

    res.json({
      success: true,
      folder
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

/**
 * PUT /api/files/rename
 * Omdøb fil eller mappe
 */
router.put('/rename', requireAuth, async (req, res) => {
  try {
    const { boxId, oldPath, newName, type } = req.body;

    if (!boxId || !oldPath || !newName) {
      return res.status(400).json({ fejl: 'Manglende felter' });
    }

    // Find box
    const box = await prisma.box.findUnique({
      where: { id: boxId }
    });

    if (!box) {
      return res.status(404).json({ fejl: 'Box ikke fundet' });
    }

    const basePath = getBasePath(box.category);
    const boxPath = path.join(basePath, box.fysiskSti);
    const oldFullPath = path.join(boxPath, oldPath);

    // Calculate new path
    const parentPath = path.dirname(oldPath);
    const newPath = parentPath === '.' ? newName : `${parentPath}/${newName}`;
    const newFullPath = path.join(boxPath, newPath);

    if (!fs.existsSync(oldFullPath)) {
      return res.status(404).json({ fejl: 'Fil/mappe ikke fundet' });
    }

    // Rename physical file/folder
    fs.renameSync(oldFullPath, newFullPath);

    // Update database
    if (type === 'file') {
      await prisma.file.updateMany({
        where: { boxId, sti: oldPath },
        data: { 
          sti: newPath,
          filnavn: newName,
          titel: extractTitle(newName)
        }
      });
    } else {
      // Update folder and all subpaths
      const folders = await prisma.folder.findMany({
        where: {
          boxId,
          sti: { startsWith: oldPath }
        }
      });

      for (const folder of folders) {
        const updatedSti = folder.sti.replace(oldPath, newPath);
        await prisma.folder.update({
          where: { id: folder.id },
          data: { sti: updatedSti }
        });
      }

      // Update files in folder
      const files = await prisma.file.findMany({
        where: {
          boxId,
          sti: { startsWith: oldPath }
        }
      });

      for (const file of files) {
        const updatedSti = file.sti.replace(oldPath, newPath);
        await prisma.file.update({
          where: { id: file.id },
          data: { sti: updatedSti }
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        handling: 'OMDOEB',
        detaljer: JSON.stringify({
          boxId,
          oldPath,
          newPath,
          type
        })
      }
    });

    console.log(`✏️ Renamed: ${oldPath} → ${newPath}`);

    res.json({
      success: true,
      oldPath,
      newPath,
      newName
    });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});


router.get('/access/:boxId', requireAuth, async (req, res) => {
  try {
    const box = await prisma.box.findUnique({ where: { id: req.params.boxId } });
    if (!box) return res.status(404).json({ fejl: 'Box ikke fundet' });
    const folderPath = String(req.query.folderPath || '');
    if (!(await ensureFolderAccess(req, res, box.id, folderPath, 'view'))) return;
    const rules = await prisma.folderAccessRule.findMany({ where: { boxId: box.id, folderPath } });
    res.json(rules);
  } catch (error) {
    console.error('Get access rules error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

router.put('/access/:boxId', requireAuth, async (req, res) => {
  try {
    const box = await prisma.box.findUnique({ where: { id: req.params.boxId } });
    if (!box) return res.status(404).json({ fejl: 'Box ikke fundet' });
    const { folderPath = '', rules = [] } = req.body;
    if (!(await ensureFolderAccess(req, res, box.id, folderPath, 'edit'))) return;

    await prisma.folderAccessRule.deleteMany({ where: { boxId: box.id, folderPath } });
    if (rules.length) {
      await prisma.folderAccessRule.createMany({
        data: rules.map((r) => ({ boxId: box.id, folderPath, rolle: r.rolle, canView: r.canView !== false, canEdit: !!r.canEdit }))
      });
    }
    const created = await prisma.folderAccessRule.findMany({ where: { boxId: box.id, folderPath } });
    res.json(created);
  } catch (error) {
    console.error('Update access rules error:', error);
    res.status(500).json({ fejl: 'Server fejl' });
  }
});

export default router;
