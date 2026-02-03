import { useCallback, useEffect, useMemo, useState } from 'react';
import FileInfoPanel from './FileInfoPanel';
import { deleteMedia, listMedia, uploadMedia } from '../../services/tinaMediaService';

const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');

const isHiddenFile = (filename) => filename === '.keep' || filename === '.gitkeep';

export default function FileExplorer({
  title,
  description,
  baseDirectory,
  uploadAccept,
  emptyMessage,
}) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [selectedItem, setSelectedItem] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');

  const loadItems = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await listMedia({ baseDir: baseDirectory, directory: currentPath });
      const directories = response.directories.map((name) => ({
        type: 'dir',
        filename: name,
      }));
      const files = response.files
        .filter((file) => !isHiddenFile(file.filename))
        .map((file) => ({
          type: 'file',
          filename: file.filename,
          src: file.src,
          directory: currentPath,
        }));

      setItems([...directories, ...files]);
      setStatus('success');
    } catch (error) {
      console.error('Failed to load media', error);
      setStatus('error');
    }
  }, [baseDirectory, currentPath]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const breadcrumb = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/');
    return parts.map((part, index) => ({
      label: part,
      path: parts.slice(0, index + 1).join('/'),
    }));
  }, [currentPath]);

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setStatus('loading');
    try {
      for (const file of files) {
        await uploadMedia({ baseDir: baseDirectory, directory: currentPath, file });
      }
      await loadItems();
    } catch (error) {
      console.error('Upload failed', error);
      setStatus('error');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setStatus('loading');
    try {
      const placeholder = new File([''], '.keep', { type: 'text/plain' });
      const folderPath = joinPath(currentPath, newFolderName.trim());
      await uploadMedia({ baseDir: baseDirectory, directory: folderPath, file: placeholder });
      setNewFolderName('');
      await loadItems();
    } catch (error) {
      console.error('Folder creation failed', error);
      setStatus('error');
    }
  };

  const handleDelete = async (item) => {
    if (!item) return;
    setStatus('loading');
    try {
      await deleteMedia({
        baseDir: baseDirectory,
        directory: item.directory,
        filename: item.filename,
      });
      setSelectedItem(null);
      await loadItems();
    } catch (error) {
      console.error('Delete failed', error);
      setStatus('error');
    }
  };

  const handleRename = async (item, nextName) => {
    if (!item || !nextName.trim() || nextName === item.filename) return;
    setStatus('loading');
    try {
      const response = await fetch(item.src);
      const blob = await response.blob();
      const renamedFile = new File([blob], nextName.trim(), { type: blob.type });
      await uploadMedia({
        baseDir: baseDirectory,
        directory: item.directory,
        file: renamedFile,
      });
      await deleteMedia({
        baseDir: baseDirectory,
        directory: item.directory,
        filename: item.filename,
      });
      setSelectedItem(null);
      await loadItems();
    } catch (error) {
      console.error('Rename failed', error);
      setStatus('error');
    }
  };

  const folders = items.filter((item) => item.type === 'dir');
  const files = items.filter((item) => item.type === 'file');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <button
          type="button"
          onClick={() => setCurrentPath('')}
          className={`font-semibold ${currentPath ? 'text-blue-600' : 'text-slate-400'}`}
        >
          Root
        </button>
        {breadcrumb.map((crumb) => (
          <button
            key={crumb.path}
            type="button"
            onClick={() => setCurrentPath(crumb.path)}
            className="text-blue-600"
          >
            / {crumb.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ny mappe"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Opret mappe
          </button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
          Upload
          <input type="file" className="hidden" multiple onChange={handleUpload} accept={uploadAccept} />
        </label>
      </div>

      {status === 'loading' && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-500">
          Henter filer...
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
          Kunne ikke hente filer. Tjek TinaCMS og prøv igen.
        </div>
      )}

      {status === 'success' && items.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500">
          {emptyMessage || 'Ingen filer endnu.'}
        </div>
      )}

      {status === 'success' && items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filer & mapper
            </div>
            <ul className="divide-y divide-slate-200">
              {folders.map((folder) => (
                <li key={`dir-${folder.filename}`} className="flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-blue-600 hover:underline"
                    onClick={() =>
                      setCurrentPath(joinPath(currentPath, folder.filename))
                    }
                  >
                    📁 {folder.filename}
                  </button>
                  <span className="text-xs text-slate-400">Mappe</span>
                </li>
              ))}
              {files.map((file) => (
                <li key={`file-${file.filename}`} className="flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-slate-700 hover:underline"
                    onClick={() => setSelectedItem(file)}
                  >
                    📄 {file.filename}
                  </button>
                  <span className="text-xs text-slate-400">Fil</span>
                </li>
              ))}
            </ul>
          </div>

          <FileInfoPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onDelete={() => handleDelete(selectedItem)}
            onRename={(nextName) => handleRename(selectedItem, nextName)}
          />
        </div>
      )}
    </section>
  );
}
