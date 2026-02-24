import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { listBoxes, createBox, updateBox, deleteBox, getNasStatus, getBoxesSummary, formatFileSize } from '../utils/fileService';
import AccessKeyPanel from '../components/AccessKeyPanel';

function Arkiv() {
  const { isAdmin } = useAdmin();
  const [boxes, setBoxes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('recent');
  const [showInfo, setShowInfo] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [nasStatus, setNasStatus] = useState({ online: false, usingLocalStorage: false });
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  
  // Form state for ny kasse
  const [newBox, setNewBox] = useState({
    titel: '',
    beskrivelse: '',
    farve: '#3b82f6',
    billede: null,
  });

  const CATEGORY = 'arkiv';

  // Hent boxes fra backend ved mount
  useEffect(() => {
    loadBoxes();
    checkNasStatus();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadBoxes(searchQuery);
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const loadBoxes = async (query = "") => {
    setIsLoading(true);
    try {
      const data = await listBoxes(CATEGORY, query);
      setBoxes(data || []);
      console.log(`📦 Loaded ${data?.length || 0} boxes from ${CATEGORY}`);
    } catch (error) {
      console.error('❌ Kunne ikke hente boxes:', error);
      setBoxes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    setIsStatsLoading(true);
    try {
      const data = await getBoxesSummary(CATEGORY);
      setStats(data);
    } catch (error) {
      console.error('❌ Kunne ikke hente box-statistik:', error);
      setStats(null);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const checkNasStatus = async () => {
    try {
      const status = await getNasStatus();
      setNasStatus(status);
      // Hent statistik i samme omgang som status, så forsiden er klar når brugeren åbner "Mere info"
      loadStats();
    } catch (error) {
      console.error('❌ NAS status fejl:', error);
    }
  };

  const handleCreateBox = async () => {
    if (!newBox.titel.trim()) {
      alert('Indtast en titel');
      return;
    }

    try {
      // Opret box på backend (backend genererer ID automatisk)
      await createBox(CATEGORY, {
        titel: newBox.titel,
        beskrivelse: newBox.beskrivelse,
        farve: newBox.farve,
        billede: newBox.billede || ''
      });

      // Reload boxes
      await loadBoxes();

      // Reset form
      setNewBox({
        titel: '',
        beskrivelse: '',
        farve: '#3b82f6',
        billede: null,
      });
      setShowCreateModal(false);

      console.log(`✅ Oprettet box i ${CATEGORY}`);
    } catch (error) {
      console.error('❌ Kunne ikke oprette box:', error);
      alert('Fejl ved oprettelse af kasse: ' + error.message);
    }
  };

  const sortedBoxes = [...boxes].sort((a, b) => {
    if (sortOption === 'title-asc') {
      return (a.titel || '').localeCompare(b.titel || '', 'da');
    }
    if (sortOption === 'title-desc') {
      return (b.titel || '').localeCompare(a.titel || '', 'da');
    }
    if (sortOption === 'files-desc') {
      const aFiles = a._count?.files || 0;
      const bFiles = b._count?.files || 0;
      return bFiles - aFiles;
    }
    if (sortOption === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    // recent (default)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const handleEditBox = async () => {
    if (!editingBox || !editingBox.titel.trim()) {
      alert('Indtast en titel');
      return;
    }

    try {
      // Opdater box metadata
      await updateBox(editingBox.id, {
        titel: editingBox.titel,
        beskrivelse: editingBox.beskrivelse,
        farve: editingBox.farve,
        billede: editingBox.billede
      });

      // Reload boxes
      await loadBoxes();

      setShowEditModal(false);
      setEditingBox(null);

      console.log(`✅ Opdateret box: ${editingBox.id}`);
    } catch (error) {
      console.error('❌ Kunne ikke opdatere box:', error);
      alert('Fejl ved opdatering: ' + error.message);
    }
  };

  const handleDeleteBox = async (boxId) => {
    if (!confirm('Er du sikker på du vil slette denne kasse? Alle filer vil blive slettet permanent.')) {
      return;
    }

    try {
      // Slet box på backend (sletter fysisk mappe + alle filer)
      await deleteBox(boxId);

      // Reload boxes
      await loadBoxes();

      console.log(`🗑️ Slettet box: ${boxId}`);
    } catch (error) {
      console.error('❌ Kunne ikke slette box:', error);
      alert('Fejl ved sletning: ' + error.message);
    }
  };

  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setNewBox({
        ...newBox,
        billede: event.target.result, // Base64 string
      });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-gray-600">Indlæser arkiv...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Arkiv</h1>
            <p className="text-gray-600">
              Centrale dokumenter og politikker for DFLelev.
            </p>
          </div>
          <div className="w-full md:w-auto space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søg i kasser, mapper og filer..."
                  className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
              </div>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="sm:w-52 px-3 py-2 rounded-xl border border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="recent">Nyeste først</option>
                <option value="oldest">Ældste først</option>
                <option value="title-asc">Titel (A-Å)</option>
                <option value="title-desc">Titel (Å-A)</option>
                <option value="files-desc">Flest filer</option>
              </select>
            </div>
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setShowInfo((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  showInfo
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>ℹ️ Mere info</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors"
                >
                  + Opret kasse
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mere info panel */}
        {showInfo && (
          <div className="mb-6 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
            {isStatsLoading || !stats ? (
              <p className="text-sm text-slate-500">Indlæser overblik over arkivet...</p>
            ) : (
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📦</span>
                  <span>
                    <span className="font-semibold">{stats.boxCount}</span> kasser
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📁</span>
                  <span>
                    <span className="font-semibold">{stats.folderCount}</span> undermapper
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📄</span>
                  <span>
                    <span className="font-semibold">{stats.fileCount}</span> filer
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">💾</span>
                  <span>
                    Samlet størrelse:{' '}
                    <span className="font-semibold">
                      {formatFileSize(stats.totalBytes)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Storage Status Banner */}
        {nasStatus.usingLocalStorage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-2xl mr-3">💻</span>
              <div>
                <p className="font-medium text-blue-800">Bruger lokal storage</p>
                <p className="text-sm text-blue-700">NAS er ikke tilsluttet - filer gemmes midlertidigt lokalt</p>
              </div>
            </div>
          </div>
        )}

        {/* Kasser Grid */}
        {sortedBoxes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Ingen kasser endnu</h2>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'Ingen kasser, mapper eller filer matcher din søgning.'
                : isAdmin
                  ? 'Klik på "Opret kasse" for at komme i gang'
                  : 'Der er ingen arkiv-kasser tilgængelige'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedBoxes.map((box) => (
              <div
                key={box.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group relative"
              >
                {/* Admin key / actions badge */}
                {isAdmin && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setAccessTarget({
                          boxId: box.id,
                          folderPath: '',
                          label: box.titel || 'Kasse',
                        })
                      }
                      className="rounded-full bg-white/90 border border-slate-200 shadow-sm px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                      title="Styr adgang til denne kasse"
                    >
                      <span>🔑</span>
                    </button>
                  </div>
                )}

                {/* Thumbnail */}
                <Link to={`/arkiv/${box.id}`}>
                  <div
                    className="h-40 flex items-center justify-center text-white text-6xl bg-gradient-to-br from-indigo-600 to-blue-600"
                    style={{ backgroundColor: box.farve || '#3b82f6' }}
                  >
                    {box.billede ? (
                      <img src={box.billede} alt={box.titel} className="w-full h-full object-cover" />
                    ) : (
                      '📦'
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4">
                  <Link to={`/arkiv/${box.id}`}>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                      {box.titel}
                    </h3>
                  </Link>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {box.beskrivelse || 'Ingen beskrivelse'}
                  </p>

                  {showInfo && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                      <div>📁 Undermapper: <span className="font-semibold">{box.stats?.folderCount ?? box._count?.folders ?? 0}</span></div>
                      <div>📄 Filer: <span className="font-semibold">{box.stats?.fileCount ?? box._count?.files ?? 0}</span></div>
                      <div>💾 Størrelse: <span className="font-semibold">{formatFileSize(box.stats?.totalBytes ?? 0)}</span></div>
                    </div>
                  )}

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setEditingBox(box);
                          setShowEditModal(true);
                        }}
                        className="flex-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded transition-colors"
                      >
                        ✏️ Rediger
                      </button>
                      <button
                        onClick={() => handleDeleteBox(box.id)}
                        className="flex-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded transition-colors"
                      >
                        🗑️ Slet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Opret Kasse Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">📦 Opret Ny Kasse</h2>

              {/* Titel */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={newBox.titel}
                  onChange={(e) => setNewBox({ ...newBox, titel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="F.eks. Arbejdstilsynet"
                />
              </div>

              {/* Beskrivelse */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivelse
                </label>
                <textarea
                  value={newBox.beskrivelse}
                  onChange={(e) => setNewBox({ ...newBox, beskrivelse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="3"
                  placeholder="Beskriv kassens indhold..."
                />
              </div>

              {/* Farve */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farve
                </label>
                <input
                  type="color"
                  value={newBox.farve}
                  onChange={(e) => setNewBox({ ...newBox, farve: e.target.value })}
                  className="w-20 h-10 rounded cursor-pointer"
                />
              </div>

              {/* Thumbnail Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billede (Valgfrit)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {newBox.billede && (
                  <img
                    src={newBox.billede}
                    alt="Preview"
                    className="mt-2 w-full h-32 object-cover rounded"
                  />
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateBox}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium transition-colors"
                >
                  Opret
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewBox({
                      titel: '',
                      beskrivelse: '',
                      farve: '#3b82f6',
                      billede: null,
                    });
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-md font-medium transition-colors"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rediger Kasse Modal */}
        {showEditModal && editingBox && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">✏️ Rediger Kasse</h2>

              {/* Titel */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={editingBox.titel}
                  onChange={(e) => setEditingBox({ ...editingBox, titel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Beskrivelse */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivelse
                </label>
                <textarea
                  value={editingBox.beskrivelse || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, beskrivelse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="3"
                />
              </div>

              {/* Farve */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farve
                </label>
                <input
                  type="color"
                  value={editingBox.farve || '#3b82f6'}
                  onChange={(e) => setEditingBox({ ...editingBox, farve: e.target.value })}
                  className="w-20 h-10 rounded cursor-pointer"
                />
              </div>

              {/* Thumbnail Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billede (Valgfrit)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setEditingBox({ ...editingBox, billede: event.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {editingBox.billede && (
                  <img
                    src={editingBox.billede}
                    alt="Preview"
                    className="mt-2 w-full h-32 object-cover rounded"
                  />
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleEditBox}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium transition-colors"
                >
                  Gem Ændringer
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBox(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-md font-medium transition-colors"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nøgle-/adgangspanel */}
      {accessTarget && (
        <AccessKeyPanel
          isOpen={!!accessTarget}
          onClose={() => setAccessTarget(null)}
          boxId={accessTarget.boxId}
          folderPath={accessTarget.folderPath}
          objectLabel={accessTarget.label}
        />
      )}
    </div>
  );
}

export default Arkiv;
