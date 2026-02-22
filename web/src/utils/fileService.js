// web/src/utils/fileService.js
// v2.0 - NAS only, auth token from correct localStorage key

const API_BASE = 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('dfl_token') || '';
}

function authHeaders(extra = {}) {
  return {
    'x-auth-token': getToken(),
    ...extra,
  };
}

/**
 * Upload files to a box
 */
export async function uploadFiles(boxId, files, currentPath = '', metadata = {}) {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('boxId', boxId);
  if (currentPath) formData.append('currentPath', currentPath);
  if (metadata.beskrivelse) formData.append('beskrivelse', metadata.beskrivelse);
  if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Upload fejlede');
  }
  return response.json();
}

/**
 * Sync box - get files and folders from backend
 */
export async function syncBox(boxId) {
  const response = await fetch(`${API_BASE}/files/sync/${boxId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Sync fejlede');
  }
  return response.json();
}

/**
 * List boxes in a category
 */
export async function listBoxes(category) {
  const response = await fetch(`${API_BASE}/boxes?category=${category}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke hente boxes');
  }
  return response.json();
}

/**
 * Get single box
 */
export async function getBox(boxId) {
  const response = await fetch(`${API_BASE}/boxes/${boxId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Box ikke fundet');
  }
  return response.json();
}

/**
 * Create new box
 */
export async function createBox(category, data) {
  const response = await fetch(`${API_BASE}/boxes`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ category, ...data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke oprette box');
  }
  return response.json();
}

/**
 * Update box metadata
 */
export async function updateBox(boxId, data) {
  const response = await fetch(`${API_BASE}/boxes/${boxId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke opdatere box');
  }
  return response.json();
}

/**
 * Delete box
 */
export async function deleteBox(boxId) {
  const response = await fetch(`${API_BASE}/boxes/${boxId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke slette box');
  }
  return response.json();
}

/**
 * Delete file or folder
 */
export async function deleteFile(boxId, filePath) {
  const response = await fetch(`${API_BASE}/files/${boxId}/${filePath}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke slette');
  }
  return response.json();
}

/**
 * Create folder
 */
export async function createFolder(boxId, currentPath, folderName, metadata = {}) {
  const response = await fetch(`${API_BASE}/files/create-folder`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      boxId,
      currentPath,
      folderName,
      titel: metadata.titel || folderName,
      beskrivelse: metadata.beskrivelse || '',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke oprette mappe');
  }
  return response.json();
}

/**
 * Rename file or folder
 */
export async function renameItem(boxId, oldPath, newName, type) {
  const response = await fetch(`${API_BASE}/files/rename`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ boxId, oldPath, newName, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke omdøbe');
  }
  return response.json();
}

/**
 * Get file download URL
 */
export function getFileUrl(boxId, filePath) {
  return `${API_BASE}/files/${boxId}/${filePath}`;
}

/**
 * Check NAS status
 */
export async function getNasStatus() {
  const response = await fetch(`${API_BASE}/nas-status`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke hente NAS status');
  }
  return response.json();
}

export async function getFolderAccessRules(boxId, folderPath = '') {
  const response = await fetch(`${API_BASE}/files/access/${boxId}?folderPath=${encodeURIComponent(folderPath)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Kunne ikke hente adgangsregler');
  return response.json();
}

export async function saveFolderAccessRules(boxId, folderPath = '', rules = []) {
  const response = await fetch(`${API_BASE}/files/access/${boxId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ folderPath, rules }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.fejl || 'Kunne ikke gemme adgangsregler');
  }
  return response.json();
}
