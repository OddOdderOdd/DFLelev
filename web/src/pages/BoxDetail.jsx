import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { syncBox, uploadFiles, createFolder, deleteFile, renameItem, getFileUrl, getNasStatus, getBox } from '../utils/fileService';
import mammoth from 'mammoth';

function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdmin();

  // Bestem kategori fra URL path
  const category = location.pathname.startsWith('/arkiv') ? 'arkiv' : 'ressourcer';

  const [box, setBox] = useState(null);
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [selectedMetadataItem, setSelectedMetadataItem] = useState(null);
  const [editMetadata, setEditMetadata] = useState({ title: '', description: '', tags: [] });
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [nasStatus, setNasStatus] = useState({ online: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState('');
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // Upload state
  const [stagedFiles, setStagedFiles] = useState([]); // Filer klar til upload (preview-step)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Form state
  const [newFolderName, setNewFolderName] = useState('');
  const [folderMetadata, setFolderMetadata] = useState({
    title: '',
    description: '',
  });
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    uploadedBy: 'admin',
    tags: [],
  });

  // Hent box metadata og sync ved mount
  useEffect(() => {
    initBox();
    checkNasStatus();
  }, [id, category, isAdmin]);

  useEffect(() => {
    if (box) {
      syncFiles();

      // Auto-sync kun hvis admin (hver 10 sekund)
      if (isAdmin) {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = setInterval(() => {
          syncFiles(true); // Silent sync
        }, 10000);
      }
    }

    // Cleanup
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [box]);

  const initBox = async () => {
    try {
      const foundBox = await getBox(id);
      
      if (foundBox) {
        setBox(foundBox);
      } else {
        console.error('Box ikke fundet');
        navigate(`/${category}`);
      }
    } catch (error) {
      console.error('Kunne ikke hente box:', error);
    }
  };

  const loadBox = initBox; // Bagudkompatibelt alias

  const checkNasStatus = async () => {
    const status = await getNasStatus();
    setNasStatus(status);
  };

  const syncFiles = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    
    try {
      const result = await syncBox(id);
      
      if (result.success) {
        setItems(result.items || []);
        setLastSyncTime(new Date());
        
        if (!silent && result.orphansCleaned > 0) {
          console.log(`🧹 Ryddet ${result.orphansCleaned} orphan metadata filer`);
        }
      }
    } catch (error) {
      console.error('Sync fejl:', error);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Filtrer items baseret på current path
  const getCurrentItems = () => {
    return items.filter(item => item.parentPath === currentPath);
  };

  // === UPLOAD HANDLERS ===

  // Vælg filer (normal, ingen mappestruktur)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newStaged = files.map(f => ({
      file: f,
      relativePath: '', // Ingen mappestruktur
      key: `${f.name}-${Date.now()}-${Math.random()}`,
    }));
    setStagedFiles(prev => [...prev, ...newStaged]);
    e.target.value = ''; // Reset input så samme filer kan vælges igen
  };

  // Vælg en hel mappe (bevarer mappestruktur via webkitRelativePath)
  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newStaged = files.map(f => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name,
      key: `${f.webkitRelativePath || f.name}-${Date.now()}-${Math.random()}`,
    }));
    setStagedFiles(prev => [...prev, ...newStaged]);
    e.target.value = '';
  };

  // Fjern en fil fra staged listen
  const removeFromStaged = (key) => {
    setStagedFiles(prev => prev.filter(s => s.key !== key));
  };

  // Udfør selve upload af staged filer (i batches på 10)
  const executeUpload = async () => {
    if (stagedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: stagedFiles.length });

    try {
      const uploadMeta = metadata.title || metadata.description ? metadata : null;
      const BATCH_SIZE = 10;

      for (let i = 0; i < stagedFiles.length; i += BATCH_SIZE) {
        const batch = stagedFiles.slice(i, i + BATCH_SIZE);

        await uploadFiles(
          category,
          id,
          batch.map(s => s.file),
          currentPath,
          uploadMeta,
          batch.map(s => s.relativePath)
        );

        setUploadProgress({ current: Math.min(i + BATCH_SIZE, stagedFiles.length), total: stagedFiles.length });
      }

      await syncFiles();

      // Reset
      setStagedFiles([]);
      setShowUploadModal(false);
      setMetadata({ title: '', description: '', uploadedBy: 'admin', tags: [] });
      console.log(`✅ Uploadede ${stagedFiles.length} filer`);
    } catch (error) {
      console.error('Upload fejl:', error);
      alert('Upload fejlede: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Indtast et mappenavn');
      return;
    }

    try {
      await createFolder(id, currentPath, newFolderName, {
          title: folderMetadata.title || newFolderName,
          description: folderMetadata.description,
          createdBy: 'admin',
        }
      );

      // Sync for at opdatere UI
      await syncFiles();

      setNewFolderName('');
      setFolderMetadata({ title: '', description: '' });
      setShowCreateFolderModal(false);

      console.log(`✅ Oprettet mappe: ${newFolderName}`);
    } catch (error) {
      console.error('Create folder fejl:', error);
      alert('Kunne ikke oprette mappe: ' + error.message);
    }
  };

  const handleDelete = async (item) => {
    const confirmMsg = item.type === 'folder' 
      ? `Slet mappen "${item.name}" og alt indhold?`
      : `Slet filen "${item.name}"?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      await deleteFile(id, item.path);

      // Sync for at opdatere UI
      await syncFiles();

      console.log(`🗑️ Slettet: ${item.name}`);
    } catch (error) {
      console.error('Delete fejl:', error);
      alert('Kunne ikke slette: ' + error.message);
    }
  };

  // === METADATA EDIT HANDLERS ===

  const handleOpenMetadata = (item) => {
    setSelectedMetadataItem(item);
    setEditMetadata({
      title: item.title || item.name,
      description: item.description || '',
      tags: item.tags || [],
    });
    setShowMetadataModal(true);
  };

  const handleSaveMetadata = async () => {
    if (!selectedMetadataItem) return;
    setIsSavingMetadata(true);

    try {
      // Backend håndterer storage i v2.0 - metadata gemmes i database

      if (selectedMetadataItem.type === 'folder') {
        // Gem folder metadata via backend
        await fileService.saveFolderMetadata(
          category,
          id,
          selectedMetadataItem.path,
          {
            title: editMetadata.title,
            description: editMetadata.description,
            updatedAt: new Date().toISOString(),
          }
        );
      } else {
        // Gem file metadata via backend
        await fileService.saveFileMetadata(
          category,
          id,
          selectedMetadataItem.path,
          {
            title: editMetadata.title,
            description: editMetadata.description,
            tags: editMetadata.tags,
            uploadedBy: selectedMetadataItem.uploadedBy || 'admin',
            uploadedAt: selectedMetadataItem.uploadedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );
      }

      await syncFiles();
      setShowMetadataModal(false);
      setSelectedMetadataItem(null);
      console.log(`📋 Metadata gemt for: ${selectedMetadataItem.name}`);
    } catch (error) {
      console.error('Gem metadata fejl:', error);
      alert('Kunne ikke gemme metadata: ' + error.message);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleRename = async (item) => {
    if (!editName.trim() || editName === item.name) {
      setEditingItemId(null);
      return;
    }

    try {
      await renameItem(
        category,
        id,
        item.path,
        editName,
        
        item.type
      );

      // Sync for at opdatere UI
      await syncFiles();

      setEditingItemId(null);
      console.log(`✏️ Omdøbt: ${item.name} → ${editName}`);
    } catch (error) {
      console.error('Rename fejl:', error);
      alert('Kunne ikke omdøbe: ' + error.message);
      setEditingItemId(null);
    }
  };

  const handleDownload = (item) => {
    const url = getFileUrl(
      category,
      id,
      item.path
    );
    
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = async (item) => {
    if (item.type === 'folder') return;

    const url = getFileUrl(
      category,
      id,
      item.path
    );

    // Metadata kommer allerede fra syncBox (database)
    // Special handling for .docx
    if (item.mimeType?.includes('wordprocessingml')) {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        setPreviewFile({
          ...item,
          url,
          htmlContent: result.value,
        });
      } catch (error) {
        console.error('Docx preview fejl:', error);
        alert('Kunne ikke vise preview af .docx fil');
      }
      return;
    }

    setPreviewFile({
      ...item,
      url,
    });
  };

  const openFolder = (folderPath) => {
    setCurrentPath(folderPath);
  };

  const goBack = () => {
    const pathParts = currentPath.split('/');
    pathParts.pop();
    setCurrentPath(pathParts.join('/'));
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: box?.title || 'Box', path: '' }];
    
    const parts = currentPath.split('/');
    const breadcrumbs = [{ name: box?.title || 'Box', path: '' }];
    
    let accumulated = '';
    parts.forEach((part, index) => {
      accumulated += (index > 0 ? '/' : '') + part;
      breadcrumbs.push({ name: part, path: accumulated });
    });
    
    return breadcrumbs;
  };

  if (!box) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">Indlæser...</p>
        </div>
      </div>
    );
  }

  const currentItems = getCurrentItems();

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/${category}`)}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Tilbage til {category === 'arkiv' ? 'Arkiv' : 'Ressourcer'}
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{box.title}</h1>
              {box.description && (
                <p className="text-gray-600">{box.description}</p>
              )}
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => syncFiles()}
                  disabled={isSyncing}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSyncing ? '⏳' : '🔄'} Sync
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  + Upload
                </button>
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  + Mappe
                </button>
              </div>
            )}
          </div>

          {/* Sync Info */}
          {lastSyncTime && isAdmin && (
            <p className="text-xs text-gray-500 mt-2">
              Sidst synkroniseret: {lastSyncTime.toLocaleTimeString('da-DK')}
            </p>
          )}
        </div>

        {/* NAS Status */}
        {!nasStatus.online && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ NAS er offline - denne kasse kan ikke tilgås
            </p>
          </div>
        )}

        {/* Breadcrumbs */}
        {currentPath && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center gap-2 text-sm">
            {getBreadcrumbs().map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-gray-400">/</span>}
                <button
                  onClick={() => setCurrentPath(crumb.path)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* File Browser */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {currentItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-gray-500">
                {currentPath ? 'Denne mappe er tom' : 'Ingen filer uploadet endnu'}
              </p>
              {isAdmin && !currentPath && (
                <p className="text-sm text-gray-400 mt-2">
                  Klik på "Upload" for at tilføje filer
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Navn
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Størrelse
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ændret
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Handlinger
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.map((item) => (
                    <tr key={item.path} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {item.type === 'folder' ? '📁' : fileService.getFileIcon(item.mimeType)}
                          </span>
                          
                          {editingItemId === item.path && isAdmin ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(item);
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRename(item)}
                                className="text-green-600 hover:text-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="text-red-600 hover:text-red-700"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div>
                              {item.type === 'folder' ? (
                                <button
                                  onClick={() => openFolder(item.path)}
                                  className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  {item.title || item.name}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePreview(item)}
                                  className="text-gray-900 hover:text-blue-600"
                                >
                                  {item.title || item.name}
                                </button>
                              )}
                              {item.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          {item.type === 'folder' ? '-' : fileService.formatFileSize(item.size)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.modified || item.created).toLocaleDateString('da-DK')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {item.type === 'file' && (
                            <button
                              onClick={() => handleDownload(item)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Download"
                            >
                              ⬇️
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenMetadata(item)}
                                className="text-purple-600 hover:text-purple-700"
                                title="Rediger metadata (titel, beskrivelse, tags)"
                              >
                                📋
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItemId(item.path);
                                  setEditName(item.name);
                                }}
                                className="text-gray-600 hover:text-gray-700"
                                title="Omdøb"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="text-red-600 hover:text-red-700"
                                title="Slet"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
              <h2 className="text-2xl font-bold mb-4">📤 Upload Filer</h2>

              {/* Skjulte file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                // webkitdirectory tillader valg af en hel mappe inkl. undermapper
                webkitdirectory=""
                multiple
                onChange={handleFolderSelect}
                className="hidden"
              />

              {/* Vælg knapper */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2"
                >
                  📄 Vælg Filer
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2"
                >
                  📁 Vælg Mappe
                </button>
              </div>

              {/* Metadata (valgfrit) */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Metadata (valgfrit – gælder alle valgte filer)</p>
                <input
                  type="text"
                  placeholder="Titel"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 text-sm"
                  disabled={isUploading}
                />
                <textarea
                  placeholder="Beskrivelse"
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  rows="2"
                  disabled={isUploading}
                />
              </div>

              {/* Staged fil liste */}
              {stagedFiles.length > 0 && (
                <div className="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
                  <div className="p-2 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {stagedFiles.length} fil{stagedFiles.length !== 1 ? 'er' : ''} klar til upload
                    </span>
                    <button
                      onClick={() => setStagedFiles([])}
                      disabled={isUploading}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Ryd alle
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {stagedFiles.map((staged) => {
                      return (
                        <div key={staged.key} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                          {/* Filnavn */}
                          <span className="text-sm flex-1 truncate text-gray-700 min-w-0" title={staged.relativePath || staged.file.name}>
                            {staged.relativePath || staged.file.name}
                          </span>

                          {/* Størrelse */}
                          <span className="text-xs text-gray-400 w-14 text-right font-mono">
                            {fileService.formatFileSize(staged.file.size)}
                          </span>

                          <button
                            onClick={() => removeFromStaged(staged.key)}
                            disabled={isUploading}
                            className="text-gray-300 hover:text-red-500 text-sm shrink-0 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload progress */}
              {isUploading && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Uploader...</span>
                    <span>{uploadProgress.current}/{uploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action knapper */}
              <div className="flex gap-3 mt-auto">
                <button
                  onClick={executeUpload}
                  disabled={stagedFiles.length === 0 || isUploading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-md font-medium"
                >
                  {isUploading ? `⏳ Uploader... (${uploadProgress.current}/${uploadProgress.total})` : `⬆️ Upload ${stagedFiles.length > 0 ? `(${stagedFiles.length})` : ''}`}
                </button>
                <button
                  onClick={() => {
                    if (!isUploading) {
                      setShowUploadModal(false);
                      setStagedFiles([]);
                      setMetadata({ title: '', description: '', uploadedBy: 'admin', tags: [] });
                    }
                  }}
                  disabled={isUploading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 py-2 rounded-md font-medium"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">📁 Opret Mappe</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mappenavn *
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Dokumenter"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  autoFocus
                />
              </div>

              {/* Metadata (valgfrit) */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Metadata (valgfrit)
                </p>
                <input
                  type="text"
                  placeholder="Titel (vises i stedet for mappenavn)"
                  value={folderMetadata.title}
                  onChange={(e) => setFolderMetadata({ ...folderMetadata, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 text-sm"
                />
                <textarea
                  placeholder="Beskrivelse"
                  value={folderMetadata.description}
                  onChange={(e) => setFolderMetadata({ ...folderMetadata, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  rows="2"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-medium"
                >
                  Opret
                </button>
                <button
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setNewFolderName('');
                    setFolderMetadata({ title: '', description: '' });
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-md font-medium"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewFile && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{previewFile.title || previewFile.name}</h3>
                  {previewFile.description && (
                    <p className="text-sm text-gray-600">{previewFile.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {previewFile.htmlContent ? (
                  // .docx preview
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewFile.htmlContent }}
                  />
                ) : previewFile.mimeType?.startsWith('image/') ? (
                  <img src={previewFile.url} alt={previewFile.name} className="max-w-full h-auto" />
                ) : previewFile.mimeType?.startsWith('video/') ? (
                  <video src={previewFile.url} controls className="max-w-full" />
                ) : previewFile.mimeType?.startsWith('audio/') ? (
                  <audio src={previewFile.url} controls className="w-full" />
                ) : previewFile.mimeType === 'application/pdf' ? (
                  <iframe src={previewFile.url} className="w-full h-[600px]" />
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-500 mb-4">Preview ikke tilgængelig</p>
                    <button
                      onClick={() => handleDownload(previewFile)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                    >
                      Download Fil
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                <div className="text-sm text-gray-600">
                  {fileService.formatFileSize(previewFile.size)}
                  {previewFile.uploadedAt && (
                    <span className="ml-4">
                      Uploadet: {new Date(previewFile.uploadedAt).toLocaleDateString('da-DK')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  ⬇️ Download
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 📋 Metadata Edit Modal — redigér titel, beskrivelse og tags for filer og mapper */}
        {showMetadataModal && selectedMetadataItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">
                  {selectedMetadataItem.type === 'folder' ? '📁' : fileService.getFileIcon(selectedMetadataItem.mimeType)}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">Rediger Metadata</h2>
                  <p className="text-sm text-gray-500 truncate">{selectedMetadataItem.name}</p>
                </div>
              </div>

              {/* Titel */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Titel
                  <span className="ml-1 text-xs font-normal text-gray-400">(Vises i stedet for filnavn)</span>
                </label>
                <input
                  type="text"
                  value={editMetadata.title}
                  onChange={(e) => setEditMetadata({ ...editMetadata, title: e.target.value })}
                  placeholder={selectedMetadataItem.name}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={isSavingMetadata}
                  autoFocus
                />
              </div>

              {/* Beskrivelse */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Beskrivelse
                </label>
                <textarea
                  value={editMetadata.description}
                  onChange={(e) => setEditMetadata({ ...editMetadata, description: e.target.value })}
                  placeholder="Beskriv indholdet..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                  rows="3"
                  disabled={isSavingMetadata}
                />
              </div>

              {/* Tags (kun for filer) */}
              {selectedMetadataItem.type === 'file' && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Tags
                    <span className="ml-1 text-xs font-normal text-gray-400">(adskil med komma)</span>
                  </label>
                  <input
                    type="text"
                    value={(editMetadata.tags || []).join(', ')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const tags = raw.split(',').map(t => t.trim()).filter(Boolean);
                      setEditMetadata({ ...editMetadata, tags });
                    }}
                    placeholder="F.eks. matematik, 8.klasse, opgave"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    disabled={isSavingMetadata}
                  />
                  {/* Tag preview */}
                  {editMetadata.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {editMetadata.tags.map((tag, i) => (
                        <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fil-info (read-only) */}
              <div className="bg-gray-50 rounded-lg p-3 mb-5 text-xs text-gray-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Filnavn:</span>
                  <span className="font-mono text-gray-700">{selectedMetadataItem.name}</span>
                </div>
                {selectedMetadataItem.type === 'file' && (
                  <div className="flex justify-between">
                    <span>Størrelse:</span>
                    <span>{fileService.formatFileSize(selectedMetadataItem.size)}</span>
                  </div>
                )}
                {selectedMetadataItem.uploadedAt && (
                  <div className="flex justify-between">
                    <span>Uploadet:</span>
                    <span>{new Date(selectedMetadataItem.uploadedAt).toLocaleString('da-DK')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Sti:</span>
                  <span className="font-mono text-gray-600 truncate max-w-[60%]" title={selectedMetadataItem.path}>{selectedMetadataItem.path}</span>
                </div>
              </div>

              {/* Knapper */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveMetadata}
                  disabled={isSavingMetadata}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {isSavingMetadata ? '⏳ Gemmer...' : '💾 Gem Metadata'}
                </button>
                <button
                  onClick={() => {
                    setShowMetadataModal(false);
                    setSelectedMetadataItem(null);
                  }}
                  disabled={isSavingMetadata}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoxDetail;
