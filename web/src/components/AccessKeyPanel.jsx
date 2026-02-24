import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFolderAccessRules, saveFolderAccessRules } from '../utils/fileService';

/**
 * Genbrugelig nøgle-/adgangskontrol for bokse og mapper.
 *
 * Bemærk: Backend arbejder i v2.0 med FolderAccessRule på sti-niveau.
 * Vi bruger derfor:
 * - folderPath: ''  for hele boksen (root)
 * - folderPath: 'Undermappe/...' for undermapper
 */
function AccessKeyPanel({ isOpen, onClose, boxId, objectLabel, folderPath }) {
  const { erAdmin } = useAuth();
  const [alleRoller, setAlleRoller] = useState([]);
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !boxId) return;
    if (!erAdmin) return;

    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      setError('');
      try {
        const [rollerRes, existingRules] = await Promise.all([
          fetch('http://localhost:3001/api/auth/roller', { headers: { 'x-auth-token': localStorage.getItem('dfl_token') || '' } }).then((r) => (r.ok ? r.json() : [])),
          getFolderAccessRules(boxId, folderPath || ''),
        ]);
        if (cancelled) return;

        setAlleRoller(Array.isArray(rollerRes) ? rollerRes : []);
        setRules(existingRules || []);
      } catch (e) {
        if (!cancelled) {
          console.error('❌ Kunne ikke hente adgangsdata:', e);
          setError('Kunne ikke hente nuværende adgangsregler.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, boxId, folderPath, erAdmin]);

  if (!isOpen) return null;
  if (!erAdmin) {
    return null;
  }

  const handleAddRole = () => {
    const unused = alleRoller.filter((r) => !rules.some((rule) => rule.rolle === r));
    const nextRole = unused[0] || alleRoller[0];
    if (!nextRole) return;
    setRules((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        rolle: nextRole,
        canView: true,
        canEdit: false,
      },
    ]);
  };

  const handleChangeRule = (index, patch) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
    );
  };

  const handleRemoveRule = (index) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const cleaned = rules
        .filter((r) => r.rolle && (r.canView || r.canEdit))
        .map((r) => ({
          rolle: r.rolle,
          canView: !!r.canView,
          canEdit: !!r.canEdit,
        }));
      await saveFolderAccessRules(boxId, folderPath || '', cleaned);
      onClose();
    } catch (e) {
      console.error('❌ Kunne ikke gemme adgangsregler:', e);
      setError('Kunne ikke gemme adgangsregler. Prøv igen.');
    } finally {
      setIsSaving(false);
    }
  };

  const description = folderPath
    ? `Adgang for undermappe: ${folderPath}`
    : 'Adgang for hele kassen';

  return (
    <div className="fixed inset-0 z-[120] flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black/40"
        onClick={() => !isSaving && onClose()}
      />

      {/* Sidepanel */}
      <div className="w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Nøgle & adgang
            </p>
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {objectLabel || 'Indhold'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-700 text-xl"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500">
            Roller her bestemmer, hvem der må se og redigere denne kasse/mappe.
            Ingen regler = synlig for alle med adgang til siden.
          </p>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Indlæser roller og regler...</p>
          ) : (
            <>
              <div className="space-y-2">
                {rules.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Ingen specifikke regler endnu. Klik på "+" for at tilføje en rolle.
                  </p>
                )}
                {rules.map((rule, index) => (
                  <div
                    key={rule.id || `${rule.rolle}-${index}`}
                    className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                  >
                    <select
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      value={rule.rolle}
                      onChange={(e) =>
                        handleChangeRule(index, { rolle: e.target.value })
                      }
                    >
                      {alleRoller.map((rolle) => (
                        <option key={rolle} value={rolle}>
                          {rolle}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!rule.canView}
                        onChange={(e) =>
                          handleChangeRule(index, { canView: e.target.checked })
                        }
                      />
                      Se
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!rule.canEdit}
                        onChange={(e) =>
                          handleChangeRule(index, { canEdit: e.target.checked })
                        }
                      />
                      Redigér
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(index)}
                      className="text-slate-300 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddRole}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                <span>➕ Tilføj rolle</span>
              </button>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl py-2 text-sm font-medium"
          >
            {isSaving ? 'Gemmer...' : 'Gem adgang'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 bg-white border border-slate-300 rounded-xl py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuller
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccessKeyPanel;

