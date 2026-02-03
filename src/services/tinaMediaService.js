import { tinaClient } from '../tina/client';

const getMediaBaseUrl = () => {
  const apiUrl = new URL(tinaClient.apiUrl);
  return `${apiUrl.origin}/media`;
};

const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');

export const listMedia = async ({ baseDir = '', directory = '', limit = 200 } = {}) => {
  const mediaBaseUrl = getMediaBaseUrl();
  const normalizedDirectory = joinPath(baseDir, directory);
  const pathSuffix = normalizedDirectory ? `/${normalizedDirectory}` : '';
  const response = await fetch(`${mediaBaseUrl}/list${pathSuffix}?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to list media');
  }

  const payload = await response.json();
  const files = payload?.files || [];
  const directories = payload?.directories || [];

  return {
    files,
    directories,
  };
};

export const uploadMedia = async ({ baseDir = '', directory = '', file }) => {
  const mediaBaseUrl = getMediaBaseUrl();
  const normalizedDirectory = joinPath(baseDir, directory);
  const uploadPath = joinPath(normalizedDirectory, file.name);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('directory', normalizedDirectory);
  formData.append('filename', file.name);

  const response = await fetch(`${mediaBaseUrl}/upload/${uploadPath}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'Failed to upload media');
  }

  return response.json().catch(() => ({}));
};

export const deleteMedia = async ({ baseDir = '', directory = '', filename }) => {
  const mediaBaseUrl = getMediaBaseUrl();
  const normalizedDirectory = joinPath(baseDir, directory);
  const path = joinPath(normalizedDirectory, filename);
  const response = await fetch(`${mediaBaseUrl}/${path}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete media');
  }
};
