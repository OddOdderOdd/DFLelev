function normalizeFolderPath(folderPath = '') {
  return String(folderPath || '').replace(/^\/+|\/+$/g, '');
}

function encodePathSegment(pathValue = '') {
  return encodeURIComponent(pathValue);
}

export function buildObjectPermissionRole(boxId, folderPath = '') {
  const cleanPath = normalizeFolderPath(folderPath);
  if (!cleanPath) return `box:${boxId}`;
  return `box:${boxId}:folder:${encodePathSegment(cleanPath)}`;
}

function parseObjectPermissionRole(rolle = '') {
  if (!rolle.startsWith('box:')) return null;
  const parts = rolle.split(':');
  if (parts.length < 2) return null;
  const boxId = parts[1];
  if (parts.length === 2) return { boxId, folderPath: '' };
  if (parts.length < 4 || parts[2] !== 'folder') return null;
  const encodedPath = parts.slice(3).join(':');
  try {
    return { boxId, folderPath: decodeURIComponent(encodedPath) };
  } catch {
    return null;
  }
}

function buildMeta({
  category,
  boxId,
  folderPath = '',
  objectType = 'box',
  objectLabel = '',
}) {
  return {
    kind: 'box',
    parentRole: null,
    canManageUnderRole: false,
    scopeKind: category,
    boxId,
    folderPath: normalizeFolderPath(folderPath),
    objectType,
    objectLabel: String(objectLabel || '').trim(),
  };
}

export async function upsertObjectPermissionEntry(prisma, payload) {
  const { boxId, folderPath = '' } = payload;
  const roleKey = buildObjectPermissionRole(boxId, folderPath);
  const permissionPayload = {
    rights: [],
    __meta: buildMeta(payload),
  };

  await prisma.permission.upsert({
    where: { rolle: roleKey },
    update: { rettigheder: JSON.stringify(permissionPayload) },
    create: { rolle: roleKey, rettigheder: JSON.stringify(permissionPayload) },
  });
}

export async function removeObjectPermissionEntry(prisma, { boxId, folderPath = '' }) {
  await prisma.permission.deleteMany({
    where: { rolle: buildObjectPermissionRole(boxId, folderPath) },
  });
}

export async function removeObjectPermissionEntriesUnderFolder(prisma, { boxId, folderPath = '' }) {
  const cleanPath = normalizeFolderPath(folderPath);
  const allObjectPermissions = await prisma.permission.findMany({
    where: { rolle: { startsWith: `box:${boxId}` } },
    select: { rolle: true },
  });

  const toDelete = allObjectPermissions
    .map((item) => item.rolle)
    .filter((rolle) => {
      const parsed = parseObjectPermissionRole(rolle);
      if (!parsed || parsed.boxId !== boxId) return false;
      if (!parsed.folderPath) return cleanPath === '';
      return parsed.folderPath === cleanPath || parsed.folderPath.startsWith(`${cleanPath}/`);
    });

  if (!toDelete.length) return;
  await prisma.permission.deleteMany({ where: { rolle: { in: toDelete } } });
}

export async function removeAllObjectPermissionEntriesForBox(prisma, boxId) {
  await prisma.permission.deleteMany({
    where: { rolle: { startsWith: `box:${boxId}` } },
  });
}

export async function renameObjectPermissionEntriesForFolder(prisma, { boxId, category, oldFolderPath, newFolderPath }) {
  const fromPath = normalizeFolderPath(oldFolderPath);
  const toPath = normalizeFolderPath(newFolderPath);
  if (!fromPath || !toPath || fromPath === toPath) return;

  const allObjectPermissions = await prisma.permission.findMany({
    where: { rolle: { startsWith: `box:${boxId}` } },
  });

  for (const permission of allObjectPermissions) {
    const parsed = parseObjectPermissionRole(permission.rolle);
    if (!parsed || parsed.boxId !== boxId || !parsed.folderPath) continue;
    if (!(parsed.folderPath === fromPath || parsed.folderPath.startsWith(`${fromPath}/`))) continue;

    const suffix = parsed.folderPath.slice(fromPath.length);
    const updatedFolderPath = `${toPath}${suffix}`;
    let parsedRights = {};
    try {
      parsedRights = JSON.parse(permission.rettigheder || '{}');
    } catch {
      parsedRights = {};
    }

    const oldBaseName = fromPath.split('/').pop() || fromPath;
    const newBaseName = toPath.split('/').pop() || toPath;
    const existingLabel = String(parsedRights?.__meta?.objectLabel || '').trim();
    const nextLabel = !existingLabel || existingLabel === oldBaseName ? newBaseName : existingLabel;

    const nextMeta = buildMeta({
      category,
      boxId,
      folderPath: updatedFolderPath,
      objectType: 'folder',
      objectLabel: nextLabel,
    });
    const nextPayload = {
      rights: Array.isArray(parsedRights?.rights) ? parsedRights.rights : [],
      __meta: nextMeta,
    };

    await prisma.permission.deleteMany({ where: { rolle: permission.rolle } });
    await prisma.permission.upsert({
      where: { rolle: buildObjectPermissionRole(boxId, updatedFolderPath) },
      update: { rettigheder: JSON.stringify(nextPayload) },
      create: { rolle: buildObjectPermissionRole(boxId, updatedFolderPath), rettigheder: JSON.stringify(nextPayload) },
    });
  }
}
