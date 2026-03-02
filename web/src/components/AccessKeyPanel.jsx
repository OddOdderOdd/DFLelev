import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFolderAccessRules, saveFolderAccessRules } from '../utils/fileService';

const DEFAULT_META = { kind: 'authority', parentRole: null, canManageUnderRole: false, scopeKind: null };

function normalizePermissions(data = {}) {
  const normalized = {};
  Object.entries(data || {}).forEach(([rolle, config]) => {
    if (Array.isArray(config)) {
      normalized[rolle] = { rights: config, __meta: { ...DEFAULT_META } };
      return;
    }
    const baseMeta = { ...DEFAULT_META, ...(config?.__meta || {}) };
    if (baseMeta.kind === 'box' && !baseMeta.scopeKind) {
      baseMeta.scopeKind = 'authority';
    }
    normalized[rolle] = { rights: config?.rights || [], __meta: baseMeta };
  });
  return normalized;
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
  const [nyUnderRolle, setNyUnderRolle] = useState({});

  const rolleMetaMap = useMemo(
    () => Object.fromEntries(Object.entries(permissionMap).map(([rolle, cfg]) => [rolle, cfg?.__meta || { ...DEFAULT_META }])),
    [permissionMap]
  );

  const underRoller = useMemo(() => {
    const result = {};
    Object.entries(rolleMetaMap).forEach(([rolle, meta]) => {
      const parent = meta?.parentRole;
      if (!parent) return;
      if (!result[parent]) result[parent] = [];
      result[parent].push(rolle);
    });
    Object.keys(result).forEach((k) => result[k].sort((a, b) => a.localeCompare(b, 'da')));
    return result;
  }, [rolleMetaMap]);

  const topLevelRoller = useMemo(
    () => alleRoller.filter((rolle) => !(rolleMetaMap[rolle]?.parentRole)),
    [alleRoller, rolleMetaMap]
  );

  const brugteRoller = useMemo(() => new Set(rules.map((r) => r.rolle)), [rules]);
  const tilgaengeligeTopLevelRoller = useMemo(
    () => topLevelRoller.filter((rolle) => !brugteRoller.has(rolle)),
    [topLevelRoller, brugteRoller]
  );

  const roleToRuleMap = useMemo(
    () => Object.fromEntries(rules.map((rule) => [rule.rolle, rule])),
    [rules]
  );

  const canUseRightFromParent = (rule, rightKey) => {
    if (!rule.uiParentRole) return true;
    return !!roleToRuleMap[rule.uiParentRole]?.[rightKey];
  };

  const normalizeRules = (inputRules, metaMap = rolleMetaMap) => {
    const roleSet = new Set(inputRules.map((r) => r.rolle));
    return inputRules.map((rule) => {
      const metaParent = metaMap[rule.rolle]?.parentRole || null;
      let uiParentRole = null;
      if (metaParent && roleSet.has(metaParent)) {
        uiParentRole = metaParent;
      } else if (rule.uiParentRole && roleSet.has(rule.uiParentRole)) {
        uiParentRole = rule.uiParentRole;
      }
      const parent = uiParentRole ? inputRules.find((r) => r.rolle === uiParentRole) : null;
      return {
        ...rule,
        uiParentRole,
        canView: parent ? !!rule.canView && !!parent.canView : !!rule.canView,
        canEdit: parent ? !!rule.canEdit && !!parent.canEdit : !!rule.canEdit,
        canDelete: parent ? !!rule.canDelete && !!parent.canDelete : !!rule.canDelete,
      };
    });
  };

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
          permissionResult.status === 'fulfilled' ? normalizePermissions(permissionResult.value) : {};
        setPermissionMap(nextPermissionMap);
        const nextMetaMap = Object.fromEntries(
          Object.entries(nextPermissionMap).map(([rolle, cfg]) => [rolle, cfg?.__meta || { ...DEFAULT_META }])
        );

        if (rollerResult.status === 'fulfilled') {
          setAlleRoller(Array.isArray(rollerResult.value) ? rollerResult.value : []);
        } else {
          setAlleRoller([]);
        }

        if (rulesResult.status === 'fulfilled') {
          const rawRules = Array.isArray(rulesResult.value) ? rulesResult.value : [];
          const nextRules = rawRules.map((rule) => ({
            ...rule,
            uiParentRole: null,
          }));
          const roleSet = new Set(nextRules.map((r) => r.rolle));
          const normalized = nextRules.map((rule) => {
            const parentRole = nextPermissionMap[rule.rolle]?.__meta?.parentRole || null;
            return {
              ...rule,
              uiParentRole: parentRole && roleSet.has(parentRole) ? parentRole : null,
            };
          });
          setRules(normalizeRules(normalized, nextMetaMap));
          setHideObject(nextRules.some((rule) => !!rule.hideObject));
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
        uiParentRole: null,
      },
    ]));
    setNyRolle('');
  };

  const handleChangeRule = (index, patch) => {
    setRules((prev) => {
      const next = prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule));
      return normalizeRules(next);
    });
  };

  const handleRemoveRule = (index) => {
    setRules((prev) => normalizeRules(prev.filter((_, i) => i !== index)));
  };

  const handleAddUnderRole = (parentRole) => {
    const current = nyUnderRolle[parentRole];
    const candidates = (underRoller[parentRole] || []).filter((rolle) => !brugteRoller.has(rolle));
    const nextRole = current || candidates[0];
    const parent = roleToRuleMap[parentRole];
    if (!nextRole || !parent) return;

    setRules((prev) => {
      const parentIndex = prev.findIndex((r) => r.rolle === parentRole);
      if (parentIndex === -1) return prev;
      let insertIndex = parentIndex + 1;
      while (insertIndex < prev.length && prev[insertIndex].uiParentRole === parentRole) {
        insertIndex += 1;
      }
      const next = [...prev];
      next.splice(insertIndex, 0, {
        id: `temp-${Date.now()}`,
        rolle: nextRole,
        canView: !!parent.canView,
        canEdit: !!parent.canEdit,
        canDelete: !!parent.canDelete,
        uiParentRole: parentRole,
      });
      return normalizeRules(next);
    });
    setNyUnderRolle((prev) => ({ ...prev, [parentRole]: '' }));
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
                        handleChangeRule(index, { rolle: e.target.value, uiParentRole: null })
                      }
                    >
                      {(rule.uiParentRole
                        ? (underRoller[rule.uiParentRole] || []).filter(
                            (rolle) => rolle === rule.rolle || !brugteRoller.has(rolle)
                          )
                        : topLevelRoller.filter((rolle) => rolle === rule.rolle || !brugteRoller.has(rolle))
                      ).map((rolle) => (
                        <option key={rolle} value={rolle}>
                          {rolle}
                        </option>
                      ))}
                      {!((rule.uiParentRole ? (underRoller[rule.uiParentRole] || []) : topLevelRoller).includes(
                        rule.rolle
                      )) && (
                        <option value={rule.rolle}>{rule.rolle}</option>
                      )}
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!rule.canView}
                        disabled={!canUseRightFromParent(rule, 'canView')}
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
                        disabled={!canUseRightFromParent(rule, 'canEdit')}
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
                        disabled={!canUseRightFromParent(rule, 'canDelete')}
                        onChange={(e) =>
                          handleChangeRule(index, { canDelete: e.target.checked })
                        }
                      />
                      Slet
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(index)}
                      className="text-slate-300 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                    {!rolleMetaMap[rule.rolle]?.parentRole && !!underRoller[rule.rolle]?.length && (
                      <div className="ml-1 flex items-center gap-1">
                        <select
                          value={nyUnderRolle[rule.rolle] || ''}
                          onChange={(e) => setNyUnderRolle((prev) => ({ ...prev, [rule.rolle]: e.target.value }))}
                          className="max-w-[9rem] rounded border border-slate-200 bg-white text-xs px-1 py-0.5"
                        >
                          <option value="">Vælg underrolle</option>
                          {(underRoller[rule.rolle] || [])
                            .filter((rolle) => !brugteRoller.has(rolle))
                            .map((rolle) => (
                              <option key={rolle} value={rolle}>
                                {rolle}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddUnderRole(rule.rolle)}
                          title="Tilføj under rolle"
                          className="h-6 w-6 rounded border border-slate-300 bg-white text-sm hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={nyRolle}
                  onChange={(e) => setNyRolle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Vælg rolle</option>
                  {tilgaengeligeTopLevelRoller.map((rolle) => (
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
