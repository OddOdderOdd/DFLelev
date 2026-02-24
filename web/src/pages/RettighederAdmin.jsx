import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RETTIGHEDS_TRAE = [
  { id: 'home', label: 'Hjem', rights: ['side:home'], children: [] },
  { id: 'kontrolpanel', label: 'Kontrolpanel', rights: ['side:kontrolpanel', 'kp:log', 'kp:verify', 'kp:brugere', 'kp:rettigheder'], children: [] },
  { id: 'mindmap', label: 'Mindmap', rights: ['side:mindmap', 'mindmap:save', 'mindmap:add-node', 'mindmap:add-group', 'mindmap:edit-text'], children: [] },
  { id: 'skolekort', label: 'Skolekort', rights: ['side:skolekort'], children: [] },
  { id: 'ressourcer', label: 'Ressourcer', rights: ['side:ressourcer', 'ressourcer:edit'], children: [{ id: 'ressourcer:mapper', label: 'Mapper & undermapper', rights: ['ressourcer:folder:edit', 'ressourcer:folder:create', 'ressourcer:folder:delete'] }] },
  { id: 'arkiv', label: 'Arkiv', rights: ['side:arkiv', 'arkiv:edit'], children: [{ id: 'arkiv:mapper', label: 'Mapper & undermapper', rights: ['arkiv:folder:edit', 'arkiv:folder:create', 'arkiv:folder:delete'] }] }
];

const DEFAULT_META = { kind: 'authority', parentRole: null, canManageUnderRole: false, scopeKind: null };

function normalizePermissions(data = {}) {
  const normalized = {};
  Object.entries(data).forEach(([rolle, config]) => {
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

function IconButton({ icon, title, onClick, className = '' }) {
  return <button title={title} onClick={onClick} className={`px-2 py-1 rounded border bg-white hover:bg-gray-50 ${className}`}>{icon}</button>;
}

export default function RettighederAdmin() {
  const navigate = useNavigate();
  const { bruger, erAdmin, token } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [roller, setRoller] = useState([]);
  const [valgtRolle, setValgtRolle] = useState('');
  const [nyRolleNavn, setNyRolleNavn] = useState('');
  const [aktivTab, setAktivTab] = useState('authority');
  const [aabenNode, setAabenNode] = useState(null);

  const rollerMap = useMemo(() => Object.fromEntries(roller.map((r) => [r, true])), [roller]);

  const kasser = useMemo(() => Object.entries(permissions)
    .filter(([, cfg]) => cfg?.__meta?.kind === 'box' && cfg.__meta.scopeKind === aktivTab)
    .map(([rolle]) => rolle)
    .filter((r) => rollerMap[r])
    .sort((a, b) => a.localeCompare(b, 'da')), [aktivTab, permissions, rollerMap]);

  const rollerTilTab = useMemo(() => {
    const kind = aktivTab;
    return Object.entries(permissions)
      .filter(([, cfg]) => cfg?.__meta?.kind === kind)
      .map(([rolle]) => rolle)
      .filter((r) => rollerMap[r])
      .sort((a, b) => a.localeCompare(b, 'da'));
  }, [aktivTab, permissions, rollerMap]);

  const underRoller = useMemo(() => {
    const result = {};
    Object.entries(permissions).forEach(([rolle, cfg]) => {
      const parent = cfg?.__meta?.parentRole;
      if (!parent || !rollerMap[rolle]) return;
      if (!result[parent]) result[parent] = [];
      result[parent].push(rolle);
    });
    Object.keys(result).forEach((k) => result[k].sort((a, b) => a.localeCompare(b, 'da')));
    return result;
  }, [permissions, rollerMap]);

  const rawAktivConfig = permissions[valgtRolle] || { rights: [], __meta: { ...DEFAULT_META } };
  const aktivMeta = { ...DEFAULT_META, ...(rawAktivConfig.__meta || {}) };
  let aktivRights = rawAktivConfig.rights || [];
  if (aktivMeta.parentRole) {
    const parentCfg = permissions[aktivMeta.parentRole];
    if (parentCfg?.rights) {
      const allowed = new Set(parentCfg.rights || []);
      aktivRights = aktivRights.filter((r) => allowed.has(r));
    } else {
      aktivRights = [];
    }
  }
  const aktivConfig = { ...rawAktivConfig, rights: aktivRights, __meta: aktivMeta };

  const parentOverskrift = aktivMeta.parentRole;
  const parentOverskriftConfig = parentOverskrift ? permissions[parentOverskrift] : null;
  const allowedRightsForChild = parentOverskriftConfig?.rights ? new Set(parentOverskriftConfig.rights || []) : null;

  const synligeRettigheder = RETTIGHEDS_TRAE;

  useEffect(() => {
    if (!erAdmin) return;
    (async () => {
      const [rollerSvar, rettighederSvar] = await Promise.all([
        fetch('/api/auth/roller'),
        fetch('/api/admin/rettigheder', { headers: { 'x-auth-token': token } })
      ]);
      if (rollerSvar.ok) setRoller(await rollerSvar.json());
      if (rettighederSvar.ok) setPermissions(normalizePermissions(await rettighederSvar.json()));
    })();
  }, [erAdmin, token]);

  async function refreshRoller() {
    const rollerSvar = await fetch('/api/auth/roller');
    if (rollerSvar.ok) setRoller(await rollerSvar.json());
  }

  function buildCleanPermissions(payload) {
    const cleaned = {};
    Object.entries(payload).forEach(([rolle, cfg]) => {
      const meta = { ...DEFAULT_META, ...(cfg.__meta || {}) };
      let rights = cfg.rights || [];
      if (meta.parentRole && payload[meta.parentRole]?.rights) {
        const allowed = new Set(payload[meta.parentRole].rights || []);
        rights = rights.filter((r) => allowed.has(r));
      }
      cleaned[rolle] = { rights, __meta: meta };
    });
    return cleaned;
  }

  async function gemRettigheder(payload = permissions) {
    const cleaned = buildCleanPermissions(payload);
    setPermissions(cleaned);
    await fetch('/api/auth/admin/rettigheder', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify(cleaned)
    });
  }

  async function opretRolle(navn, meta) {
    const clean = navn.trim();
    if (!clean) return;
    const svar = await fetch('/api/admin/roller', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ navn: clean })
    });
    if (!svar.ok) return;
    const next = { ...permissions, [clean]: { rights: permissions[clean]?.rights || [], __meta: { ...DEFAULT_META, ...meta } } };
    setPermissions(next);
    await gemRettigheder(next);
    setValgtRolle(clean);
    setNyRolleNavn('');
    await refreshRoller();
  }

  async function omdoebRolle(rolle) {
    const nytNavn = window.prompt('Nyt navn', rolle)?.trim();
    if (!nytNavn || nytNavn === rolle) return;
    const svar = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/omdoeb`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ nytNavn })
    });
    if (!svar.ok) return;
    const next = { ...permissions, [nytNavn]: { ...(permissions[rolle] || { rights: [], __meta: { ...DEFAULT_META } }) } };
    delete next[rolle];
    Object.keys(next).forEach((key) => { if (next[key]?.__meta?.parentRole === rolle) next[key].__meta.parentRole = nytNavn; });
    setPermissions(next);
    await gemRettigheder(next);
    if (valgtRolle === rolle) setValgtRolle(nytNavn);
    await refreshRoller();
  }

  async function sletRolle(rolle) {
    if (!window.confirm(`Slet ${rolle}?`)) return;
    const svar = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/anmod-slet`, { method: 'POST', headers: { 'x-auth-token': token } });
    if (!svar.ok) return;
    const bekraeft = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/bekraeft-slet`, { method: 'POST', headers: { 'x-auth-token': token } });
    if (!bekraeft.ok) return;

    const next = { ...permissions };
    delete next[rolle];
    Object.keys(next).forEach((key) => { if (next[key]?.__meta?.parentRole === rolle) next[key].__meta.parentRole = null; });
    setPermissions(next);
    await gemRettigheder(next);
    if (valgtRolle === rolle) setValgtRolle('');
    await refreshRoller();
  }

  function toggleRight(right) {
    if (!valgtRolle) return;
    setPermissions((prev) => {
      const current = prev[valgtRolle] || { rights: [], __meta: { ...DEFAULT_META } };
      const meta = { ...DEFAULT_META, ...(current.__meta || {}) };
      const rightsSet = new Set(current.rights || []);
      const hadRight = rightsSet.has(right);
      if (hadRight) rightsSet.delete(right); else rightsSet.add(right);

      const next = { ...prev, [valgtRolle]: { ...current, rights: [...rightsSet] } };

      if (meta.kind === 'box') {
        const parentRightsAfter = new Set(rightsSet);
        const isAdding = !hadRight;
        Object.entries(prev).forEach(([rolleNavn, cfg]) => {
          const childMeta = { ...DEFAULT_META, ...(cfg.__meta || {}) };
          if (childMeta.parentRole !== valgtRolle) return;
          const childRights = new Set(cfg.rights || []);

          if (childMeta.canManageUnderRole) {
            // Ansvarlige roller spejler altid alle rettigheder fra overskriften
            next[rolleNavn] = { ...cfg, rights: [...parentRightsAfter] };
          } else {
            // Ikke-ansvarlige roller kan have færre rettigheder, men mister rettigheder der fjernes fra overskriften
            if (!isAdding) {
              childRights.delete(right);
              next[rolleNavn] = { ...cfg, rights: [...childRights] };
            }
          }
        });
      } else if (meta.parentRole && prev[meta.parentRole]?.rights) {
        const allowed = new Set(prev[meta.parentRole].rights || []);
        next[valgtRolle].rights = next[valgtRolle].rights.filter((r) => allowed.has(r));
      }

      return next;
    });
  }

  function setAnsvarligForAktiv(checked) {
    if (!valgtRolle) return;
    setPermissions((prev) => {
      const current = prev[valgtRolle] || { rights: [], __meta: { ...DEFAULT_META } };
      const meta = { ...DEFAULT_META, ...(current.__meta || {}) };
      const parent = meta.parentRole ? prev[meta.parentRole] : null;
      let nextRights = current.rights || [];

      // Når en rolle gøres ansvarlig for en overskrift, får den automatisk alle rettigheder fra overskriften
      if (checked && parent?.rights) {
        nextRights = [...parent.rights];
      } else if (meta.parentRole && parent?.rights) {
        // Ved fravalg sikrer vi stadig at rettigheder ikke overstiger overskriften
        const allowed = new Set(parent.rights || []);
        nextRights = nextRights.filter((r) => allowed.has(r));
      }

      const nextMeta = { ...meta, canManageUnderRole: checked };
      return { ...prev, [valgtRolle]: { ...current, rights: nextRights, __meta: nextMeta } };
    });
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun admin/owner har adgang.</div>;

  const tabLabel = { authority: 'Myndigheder', year: 'Årgange', dorm: 'Kollegie' };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500">← Tilbage</button>
        <h1 className="text-3xl font-bold">Rettigheder & Roller</h1>

        <div className="flex gap-2">
          {Object.entries(tabLabel).map(([id, label]) => <button key={id} onClick={() => setAktivTab(id)} className={`px-3 py-2 rounded-lg border text-sm ${aktivTab === id ? 'bg-gray-900 text-white' : 'bg-white'}`}>{label}</button>)}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">{tabLabel[aktivTab]}</h3>
              <div className="flex gap-2">
                <input value={nyRolleNavn} onChange={(e) => setNyRolleNavn(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder={`Opret ${tabLabel[aktivTab].toLowerCase()}`} />
                <button onClick={() => opretRolle(nyRolleNavn, { kind: aktivTab, parentRole: null })} className="px-3 py-2 bg-indigo-700 text-white rounded-lg text-sm">Opret</button>
                <button onClick={() => opretRolle(nyRolleNavn, { kind: 'box', parentRole: null, scopeKind: aktivTab })} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Opret overskrift</button>
              </div>
              <div className="space-y-1">
                {rollerTilTab.map((rolle) => <div key={rolle} className="flex items-center justify-between border rounded px-2 py-1"><button onClick={() => setValgtRolle(rolle)} className={`text-sm ${valgtRolle === rolle ? 'text-blue-700 font-medium' : ''}`}>{rolle}</button><div className="flex gap-1"><IconButton icon="✏️" title="Rediger navn" onClick={() => omdoebRolle(rolle)} /><IconButton icon="🗑️" title="Slet" onClick={() => sletRolle(rolle)} /><IconButton icon="🔐" title="Juster magt" onClick={() => setValgtRolle(rolle)} className="text-blue-700" /><IconButton icon="👥" title="Se brugere" onClick={() => navigate('/brugere')} /></div></div>)}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Overskrifter</h3>
              {kasser.map((kasse) => (
                <div key={kasse} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setValgtRolle(kasse)} className={`font-medium text-left ${valgtRolle === kasse ? 'text-blue-700' : ''}`}>{kasse}</button>
                    <div className="flex gap-1">
                      <IconButton icon="➕" title="Tilføj rolle" onClick={() => { const navn = window.prompt('Navn på rolle under kasse'); if (navn) opretRolle(navn, { kind: 'role', parentRole: kasse, canManageUnderRole: false }); }} />
                      <IconButton icon="✏️" title="Rediger navn" onClick={() => omdoebRolle(kasse)} />
                      <IconButton icon="🔐" title="Juster rettigheder" onClick={() => setValgtRolle(kasse)} className="text-blue-700" />
                      <IconButton icon="🗑️" title="Slet gruppe" onClick={() => sletRolle(kasse)} />
                    </div>
                  </div>
                  {(underRoller[kasse] || []).map((rolle) => (
                    <div key={rolle} className="flex items-center justify-between border rounded px-2 py-1">
                      <button className={`text-sm ${valgtRolle === rolle ? 'text-blue-700 font-medium' : ''}`} onClick={() => setValgtRolle(rolle)}>{rolle}</button>
                      <div className="flex gap-1"><IconButton icon="✏️" title="Rediger navn" onClick={() => omdoebRolle(rolle)} /><IconButton icon="🗑️" title="Slet rolle" onClick={() => sletRolle(rolle)} /><IconButton icon="🔐" title="Juster rettigheder" onClick={() => setValgtRolle(rolle)} className="text-blue-700" /><IconButton icon="👥" title="Se brugere" onClick={() => navigate('/brugere')} /></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Magt for rollen: {valgtRolle || '—'}</h3>
              <button onClick={() => gemRettigheder()} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm">Gem rettigheder</button>
            </div>
            {aktivMeta.parentRole && (
              <div className="mb-3 border rounded-md px-3 py-2 bg-gray-50">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!aktivMeta.canManageUnderRole}
                    onChange={(e) => setAnsvarligForAktiv(e.target.checked)}
                  />
                  <span>Gør denne rolle ansvarlig for: {aktivMeta.parentRole}</span>
                </label>
              </div>
            )}
            <div className="space-y-3">
              {synligeRettigheder.map((node) => (
                <div key={node.id} className="border rounded-xl p-3">
                  <button onClick={() => setAabenNode(aabenNode === node.id ? null : node.id)} className="text-sm font-medium">{node.label}</button>
                  {aabenNode === node.id && (
                    <div className="mt-2 space-y-2">
                      {node.rights
                        .filter((r) => !allowedRightsForChild || allowedRightsForChild.has(r))
                        .map((r) => (
                          <label key={r} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={(aktivConfig.rights || []).includes(r)}
                              onChange={() => toggleRight(r)}
                            />
                            <span>{r}</span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
