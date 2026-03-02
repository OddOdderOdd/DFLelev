import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFolderAccessRules, saveFolderAccessRules } from '../utils/fileService';

const DEFAULT_META = { kind: 'role', tabId: null, groupId: null };
const TABS_META_ROLE = '__dfl_tabs__';
const GROUPS_META_ROLE = '__dfl_groups__';

const FALLBACK_TABS = [
  { id: 'admins', label: 'Admins' },
  { id: 'year', label: 'Årgange' },
  { id: 'dorm', label: 'Kollegie' },
];

function normalizePermissions(data = {}) {
  const normalized = {};
  Object.entries(data || {}).forEach(([rolle, config]) => {
    if (rolle === TABS_META_ROLE || rolle === GROUPS_META_ROLE) {
      normalized[rolle] = config;
      return;
    }
    if (Array.isArray(config)) {
      normalized[rolle] = { rights: config, __meta: { ...DEFAULT_META } };
      return;
    }
    const baseMeta = { ...DEFAULT_META, ...(config?.__meta || {}) };
    normalized[rolle] = { rights: config?.rights || [], __meta: baseMeta };
  });
  return normalized;
}

function readTabsFromPermissions(permissionMap) {
  const entry = permissionMap[TABS_META_ROLE];
  if (!entry?.__meta?.tabs || !Array.isArray(entry.__meta.tabs)) {
    return FALLBACK_TABS;
  }
  const seen = new Map();
  FALLBACK_TABS.forEach((t) => seen.set(t.id, t));
  entry.__meta.tabs.forEach((t) => {
    const id = String(t.id || t.label || '').trim() || 'ny-fane';
    const label = String(t.label || t.id || id);
    seen.set(id, { id, label });
  });
  return Array.from(seen.values());
}

function readGroupsFromPermissions(permissionMap) {
  const entry = permissionMap[GROUPS_META_ROLE];
  if (!entry?.__meta?.groups || !Array.isArray(entry.__meta.groups)) {
    return [];
  }
  return entry.__meta.groups;
}

/**
 * Genbrugelig nøgle-/adgangskontrol for bokse, mapper og filer.
 *
 * Bemærk: Backend arbejder i v2.0 med FolderAccessRule på sti-niveau.
 * Vi bruger derfor:
 * - folderPath: ''  for hele boksen (root)
 * - folderPath: 'Undermappe/...' for undermapper
 */
function AccessKeyPanel({
  isOpen,
  onClose,
  boxId,
  objectLabel,
  folderPath,
  objectType = 'folder',
  showHideToggle = false,
}) {
  const { erAdmin, token } = useAuth();
  const [alleRoller, setAlleRoller] = useState([]);
  const [permissionMap, setPermissionMap] = useState({});
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [hideObject, setHideObject] = useState(false);
  const [nyRolle, setNyRolle] = useState('');
  const [collapsedRoles, setCollapsedRoles] = useState({});

  const [valgtTabId, setValgtTabId] = useState('admins');
  const [valgtScope, setValgtScope] = useState(''); // "role:<rolle>" eller "group:<id>"
  const [valgtUnderRolle, setValgtUnderRolle] = useState('');

  const rolleMetaMap = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(permissionMap)
          .filter(([rolle]) => rolle !== TABS_META_ROLE && rolle !== GROUPS_META_ROLE)
          .map(([rolle, cfg]) => [rolle, cfg?.__meta || { ...DEFAULT_META }])
      ),
    [permissionMap]
  );

  const tabs = useMemo(() => readTabsFromPermissions(permissionMap), [permissionMap]);
  const groups = useMemo(() => readGroupsFromPermissions(permissionMap), [permissionMap]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((t) => t.id === valgtTabId)) {
      setValgtTabId(tabs[0].id);
    }
  }, [tabs, valgtTabId]);

  const grupperIaktivFane = useMemo(
    () => groups.filter((g) => g.tabId === valgtTabId),
    [groups, valgtTabId]
  );

  const topLevelRoller = useMemo(() => {
    return alleRoller.filter((rolle) => {
      const meta = rolleMetaMap[rolle] || DEFAULT_META;
      if (meta.groupId) return false;
      const tabId = meta.tabId || tabs[0]?.id || 'admins';
      return tabId === valgtTabId;
    });
  }, [alleRoller, rolleMetaMap, tabs, valgtTabId]);

  const rollerIValgtGruppe = useMemo(() => {
    const scope = valgtScope.startsWith('group:') ? valgtScope.split(':')[1] : '';
    if (!scope) return [];
    return alleRoller.filter(
      (rolle) => (rolleMetaMap[rolle] || DEFAULT_META).groupId === scope
    );
  }, [alleRoller, rolleMetaMap, valgtScope]);

  const brugteRoller = useMemo(() => new Set(rules.map((r) => r.rolle)), [rules]);

  const tilgaengeligeRollerIScope = useMemo(() => {
    const scopeIsGroup = valgtScope.startsWith('group:');
    if (scopeIsGroup) return rollerIValgtGruppe.filter((rolle) => !brugteRoller.has(rolle));
    return topLevelRoller.filter((rolle) => !brugteRoller.has(rolle));
  }, [topLevelRoller, rollerIValgtGruppe, brugteRoller, valgtScope]);

  const normalizeRules = (inputRules) =>
    inputRules.map((rule) => ({
      ...rule,
      canView: !!rule.canView,
      canEdit: !!rule.canEdit,
      canDelete: !!rule.canDelete,
    }));

  useEffect(() => {
    if (!isOpen || !boxId) return;
    if (!erAdmin) return;

    let cancelled = false;
    async function loadData() {
      setIsLoading(true);
      setError('');
      try {
        const [rollerResult, rulesResult, permissionResult] = await Promise.allSettled([
          fetch('/api/auth/roller', { headers: { 'x-auth-token': token || '' } }).then((r) => (r.ok ? r.json() : [])),
          getFolderAccessRules(boxId, folderPath || ''),
          fetch('/api/admin/rettigheder', { headers: { 'x-auth-token': token || '' } }).then((r) => (r.ok ? r.json() : {})),
        ]);
        if (cancelled) return;

        const nextPermissionMap =
          permissionResult.status === 'fulfilled'
            ? normalizePermissions(permissionResult.value)
            : {};
        setPermissionMap(nextPermissionMap);

        if (rollerResult.status === 'fulfilled') {
          setAlleRoller(Array.isArray(rollerResult.value) ? rollerResult.value : []);
        } else {
          setAlleRoller([]);
        }

        if (rulesResult.status === 'fulfilled') {
          const rawRules = Array.isArray(rulesResult.value) ? rulesResult.value : [];
          const normalized = normalizeRules(rawRules);
          setRules(normalized);
          setHideObject(normalized.some((rule) => !!rule.hideObject));
        } else {
          throw rulesResult.reason;
        }
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
  }, [isOpen, boxId, folderPath, erAdmin, token]);

  if (!isOpen) return null;
  if (!erAdmin) {
    return null;
  }

  const handleAddRole = () => {
    const nextRole = nyRolle;
    if (!nextRole) return;
    setRules((prev) => normalizeRules([
      ...prev,
      {
        id: `temp-${Date.now()}`,
        rolle: nextRole,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
    ]));
    setNyRolle('');
    setValgtUnderRolle('');
  };

  const handleChangeRule = (index, patch) => {
    setRules((prev) =>
      normalizeRules(prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
    );
  };

  const handleRemoveRule = (index) => {
    setRules((prev) => normalizeRules(prev.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const cleaned = rules
        .filter((r) => r.rolle && (r.canView || r.canEdit || r.canDelete))
        .map((r) => ({
          rolle: r.rolle,
          canView: !!r.canView,
          canEdit: !!r.canEdit,
          canDelete: !!r.canDelete,
          hideObject: isHideObjectAvailable ? !!hideObject : false,
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
  const isHideObjectAvailable =
    showHideToggle && (objectType === 'folder' || objectType === 'file' || objectType === 'box');

  return (
    <div className="fixed inset-0 z-[120] flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black/40"
        onClick={() => !isSaving && onClose()}
      />

      {/* Sidepanel */}
      <div className="w-full max-w-xl bg-white shadow-2xl h-full overflow-y-auto transition-all">
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
            Roller her bestemmer, hvem der må se, redigere og slette dette objekt.
            Ingen regler = synlig for alle med adgang til siden.
          </p>
          {isHideObjectAvailable && (
            <label className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-800">Skjul objekt</p>
                <p className="text-xs text-slate-500">
                  Skjuler objektet for brugere uden &quot;Se&quot;-rettighed.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hideObject}
                onChange={(e) => setHideObject(e.target.checked)}
              />
            </label>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Indlæser roller og regler...</p>
          ) : (
            <>
              <div className="space-y-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-600 font-semibold">Vælg fane</span>
                  <select
                    value={valgtTabId}
                    onChange={(e) => {
                      setValgtTabId(e.target.value);
                      setValgtScope('');
                      setValgtUnderRolle('');
                      setNyRolle('');
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    {tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-slate-600 font-semibold">
                    Vælg rolle eller gruppe
                  </span>
                  <select
                    value={valgtScope}
                    onChange={(e) => {
                      setValgtScope(e.target.value);
                      setValgtUnderRolle('');
                      setNyRolle('');
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    <option value="">Vælg rolle / gruppe</option>
                    {topLevelRoller.map((rolle) => (
                      <option key={`role-${rolle}`} value={`role:${rolle}`}>
                        Rolle: {rolle}
                      </option>
                    ))}
                    {grupperIaktivFane.map((g) => (
                      <option key={`group-${g.id}`} value={`group:${g.id}`}>
                        Gruppe: {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                {valgtScope.startsWith('group:') && (
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-600 font-semibold">
                      Vælg rolle i gruppen
                    </span>
                    <select
                      value={valgtUnderRolle}
                      onChange={(e) => {
                        setValgtUnderRolle(e.target.value);
                        setNyRolle(e.target.value);
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    >
                      <option value="">Vælg rolle</option>
                      {rollerIValgtGruppe.map((rolle) => (
                        <option key={`sub-${rolle}`} value={rolle}>
                          {rolle}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {rules.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Ingen specifikke regler endnu. Vælg fane/rolle og klik på "Tilføj rolle".
                  </p>
                )}
                {rules.map((rule, index) => (
                  <div
                    key={rule.id || `${rule.rolle}-${index}`}
                    className="flex flex-col gap-1 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedRoles((prev) => ({
                            ...prev,
                            [rule.rolle]: !prev[rule.rolle],
                          }))
                        }
                        className="text-xs w-5 h-5 flex items-center justify-center rounded border border-slate-300 text-slate-600 bg-white"
                        title={
                          collapsedRoles[rule.rolle]
                            ? 'Forstør denne rolle'
                            : 'Minimér denne rolle'
                        }
                      >
                        {collapsedRoles[rule.rolle] ? '+' : '−'}
                      </button>
                      <span className="flex-1 text-sm truncate">{rule.rolle}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(index)}
                        className="text-slate-300 hover:text-red-500 text-sm"
                        title="Fjern denne rolle"
                      >
                        ✕
                      </button>
                    </div>
                    {!collapsedRoles[rule.rolle] && (
                      <div className="flex flex-wrap gap-3 pl-6 pt-1">
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
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!rule.canDelete}
                            onChange={(e) =>
                              handleChangeRule(index, { canDelete: e.target.checked })
                            }
                          />
                          Slet
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={nyRolle}
                  onChange={(e) => {
                    setNyRolle(e.target.value);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Vælg rolle</option>
                  {tilgaengeligeRollerIScope.map((rolle) => (
                    <option key={rolle} value={rolle}>
                      {rolle}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddRole}
                  disabled={!nyRolle}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <span>➕ Tilføj rolle</span>
                </button>
              </div>
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
