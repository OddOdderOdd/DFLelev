import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RETTIGHEDS_TRAE = [
  { id: 'home', label: 'Hjem', rights: ['side:home'], children: [] },
  { id: 'kontrolpanel', label: 'Kontrolpanel', rights: ['side:kontrolpanel', 'kp:log', 'kp:verify', 'kp:brugere', 'kp:rettigheder'], children: [] },
  {
    id: 'mindmap',
    label: 'Mindmap',
    rights: ['side:mindmap', 'mindmap:save', 'mindmap:add-node', 'mindmap:add-group', 'mindmap:edit-text'],
    children: [
      { id: 'mindmap:tillidsmandskredsen', label: 'Tillidsmandskredsen', rights: ['mindmap:group:edit', 'mindmap:group:link', 'mindmap:group:meta', 'mindmap:group:delete'] },
      { id: 'mindmap:styrelsen', label: 'Styrelsen', rights: ['mindmap:group:edit', 'mindmap:group:link', 'mindmap:group:meta', 'mindmap:group:delete'] },
      { id: 'mindmap:fu', label: 'FU', rights: ['mindmap:group:edit', 'mindmap:group:link', 'mindmap:group:meta', 'mindmap:group:delete'] }
    ]
  },
  { id: 'skolekort', label: 'Skolekort', rights: ['side:skolekort'], children: [] },
  {
    id: 'ressourcer',
    label: 'Ressourcer',
    rights: ['side:ressourcer', 'ressourcer:edit'],
    children: [{ id: 'ressourcer:mapper', label: 'Mapper & undermapper', rights: ['ressourcer:folder:edit', 'ressourcer:folder:create', 'ressourcer:folder:delete'] }]
  },
  {
    id: 'arkiv',
    label: 'Arkiv',
    rights: ['side:arkiv', 'arkiv:edit'],
    children: [{ id: 'arkiv:mapper', label: 'Mapper & undermapper', rights: ['arkiv:folder:edit', 'arkiv:folder:create', 'arkiv:folder:delete'] }]
  }
];

const DEFAULT_META = { kind: 'authority', parentRole: null, canManageUnderRole: false };

function normalizePermissions(data = {}) {
  const normalized = {};
  Object.entries(data).forEach(([rolle, config]) => {
    if (Array.isArray(config)) {
      normalized[rolle] = { rights: config, __meta: { ...DEFAULT_META } };
      return;
    }
    normalized[rolle] = {
      rights: config?.rights || [],
      __meta: { ...DEFAULT_META, ...(config?.__meta || {}) }
    };
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
  const [nyKasseNavn, setNyKasseNavn] = useState('');
  const [nyMyndighedNavn, setNyMyndighedNavn] = useState('');
  const [aabenNode, setAabenNode] = useState(null);

  const rollerMap = useMemo(() => {
    const map = {};
    roller.forEach((rolle) => { map[rolle] = true; });
    return map;
  }, [roller]);

  const kasser = useMemo(() => {
    const fromPermissions = Object.entries(permissions)
      .filter(([, cfg]) => cfg?.__meta?.kind === 'box')
      .map(([rolle]) => rolle)
      .filter((r) => rollerMap[r]);
    return [...new Set(fromPermissions)].sort((a, b) => a.localeCompare(b, 'da'));
  }, [permissions, rollerMap]);

  const frieMyndigheder = useMemo(() => {
    const explicit = Object.entries(permissions)
      .filter(([, cfg]) => cfg?.__meta?.kind === 'authority')
      .map(([rolle]) => rolle)
      .filter((r) => rollerMap[r]);
    const system = ['Admin', 'Owner'];
    const rest = roller.filter((r) => !system.includes(r) && !kasser.includes(r) && !Object.values(permissions).some((cfg) => cfg?.__meta?.parentRole === r));
    return [...new Set([...system, ...explicit, ...rest])].sort((a, b) => a.localeCompare(b, 'da'));
  }, [permissions, roller, kasser]);

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

  const aktivConfig = permissions[valgtRolle] || { rights: [], __meta: { ...DEFAULT_META } };
  const parentConfig = aktivConfig.__meta.parentRole ? permissions[aktivConfig.__meta.parentRole] : null;

  const synligeRettigheder = useMemo(() => {
    if (!aktivConfig.__meta.parentRole) return RETTIGHEDS_TRAE;
    const parentRights = new Set(parentConfig?.rights || []);
    return RETTIGHEDS_TRAE
      .map((node) => {
        const nodeRights = node.rights.filter((r) => parentRights.has(r));
        const children = (node.children || []).map((child) => ({ ...child, rights: child.rights.filter((r) => parentRights.has(r)) })).filter((child) => child.rights.length > 0);
        if (nodeRights.length === 0 && children.length === 0) return null;
        return { ...node, rights: nodeRights, children };
      })
      .filter(Boolean);
  }, [aktivConfig.__meta.parentRole, parentConfig]);

  useEffect(() => {
    if (!erAdmin) return;
    (async () => {
      const [rollerSvar, rettighederSvar] = await Promise.all([
        fetch('/api/auth/roller'),
        fetch('/api/admin/rettigheder', { headers: { 'x-auth-token': token } })
      ]);

      if (rollerSvar.ok) setRoller(await rollerSvar.json());
      if (rettighederSvar.ok) {
        const data = await rettighederSvar.json();
        setPermissions(normalizePermissions(data));
      }
    })();
  }, [erAdmin, token]);

  useEffect(() => {
    if (!valgtRolle && roller.length > 0) setValgtRolle(roller[0]);
  }, [roller, valgtRolle]);

  async function refreshRoller() {
    const rollerSvar = await fetch('/api/auth/roller');
    if (rollerSvar.ok) setRoller(await rollerSvar.json());
  }

  async function opretRolle(navn, meta) {
    const clean = navn.trim();
    if (!clean) return;
    const svar = await fetch('/api/admin/roller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ navn: clean })
    });
    if (!svar.ok) return;
    setPermissions((prev) => ({ ...prev, [clean]: { rights: prev[clean]?.rights || [], __meta: { ...DEFAULT_META, ...meta } } }));
    setValgtRolle(clean);
    await refreshRoller();
  }

  async function omdoebRolle(rolle) {
    const nytNavn = window.prompt('Nyt navn', rolle)?.trim();
    if (!nytNavn || nytNavn === rolle) return;
    const svar = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/omdoeb`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ nytNavn })
    });
    if (!svar.ok) return;

    setPermissions((prev) => {
      const next = { ...prev };
      next[nytNavn] = { ...(next[rolle] || { rights: [], __meta: { ...DEFAULT_META } }) };
      delete next[rolle];
      Object.keys(next).forEach((key) => {
        if (next[key]?.__meta?.parentRole === rolle) next[key].__meta.parentRole = nytNavn;
      });
      return next;
    });

    if (valgtRolle === rolle) setValgtRolle(nytNavn);
    await refreshRoller();
  }

  async function sletRolle(rolle) {
    if (!window.confirm(`Slet ${rolle}?`)) return;
    const svar = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/anmod-slet`, {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    if (!svar.ok) return;
    const bekraeft = await fetch(`/api/admin/roller/${encodeURIComponent(rolle)}/bekraeft-slet`, {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    if (!bekraeft.ok) return;

    setPermissions((prev) => {
      const next = { ...prev };
      delete next[rolle];
      Object.keys(next).forEach((key) => {
        if (next[key]?.__meta?.parentRole === rolle) next[key].__meta.parentRole = null;
      });
      return next;
    });
    if (valgtRolle === rolle) setValgtRolle('');
    await refreshRoller();
  }

  function toggleRight(right) {
    const cur = new Set(aktivConfig.rights || []);
    if (cur.has(right)) cur.delete(right); else cur.add(right);
    setPermissions((prev) => ({ ...prev, [valgtRolle]: { ...aktivConfig, rights: [...cur] } }));
  }

  async function gemRettigheder() {
    await fetch('/api/auth/admin/rettigheder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(permissions)
    });
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun admin/owner har adgang.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500">← Tilbage</button>
        <h1 className="text-3xl font-bold">Rettigheder & Roller</h1>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Myndigheder (uden kasse)</h3>
              <div className="flex gap-2">
                <input value={nyMyndighedNavn} onChange={(e) => setNyMyndighedNavn(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Opret myndighed" />
                <button onClick={() => { opretRolle(nyMyndighedNavn, { kind: 'authority', parentRole: null }); setNyMyndighedNavn(''); }} className="px-3 py-2 bg-indigo-700 text-white rounded-lg text-sm">Opret myndighed</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {frieMyndigheder.map((r) => (
                  <button key={r} onClick={() => setValgtRolle(r)} className={`px-2 py-1 border rounded text-sm ${valgtRolle === r ? 'bg-gray-900 text-white' : 'bg-white'}`}>{r}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Kasser (overskrifter)</h3>
              <div className="flex gap-2">
                <input value={nyKasseNavn} onChange={(e) => setNyKasseNavn(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Opret kasse" />
                <button onClick={() => { opretRolle(nyKasseNavn, { kind: 'box', parentRole: null }); setNyKasseNavn(''); }} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Opret kasse</button>
              </div>
              <div className="space-y-3">
                {kasser.map((kasse) => (
                  <div key={kasse} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => setValgtRolle(kasse)} className={`font-medium text-left ${valgtRolle === kasse ? 'text-blue-700' : ''}`}>{kasse}</button>
                      <div className="flex gap-1">
                        <IconButton icon="➕" title="Tilføj rolle" onClick={() => {
                          const navn = window.prompt('Navn på rolle under kasse');
                          if (!navn) return;
                          opretRolle(navn, { kind: 'role', parentRole: kasse, canManageUnderRole: false });
                        }} />
                        <IconButton icon="✏️" title="Rediger navn" onClick={() => omdoebRolle(kasse)} />
                        <IconButton icon="🗑️" title="Slet gruppe" onClick={() => sletRolle(kasse)} />
                        <IconButton icon="🔐" title="Juster rettigheder" onClick={() => setValgtRolle(kasse)} className="text-blue-700" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(underRoller[kasse] || []).map((rolle) => (
                        <div key={rolle} className="flex items-center justify-between border rounded px-2 py-1">
                          <button className={`text-sm ${valgtRolle === rolle ? 'text-blue-700 font-medium' : ''}`} onClick={() => setValgtRolle(rolle)}>{rolle}</button>
                          <div className="flex gap-1">
                            <IconButton icon="✏️" title="Rediger navn" onClick={() => omdoebRolle(rolle)} />
                            <IconButton icon="🗑️" title="Slet rolle" onClick={() => sletRolle(rolle)} />
                            <IconButton icon="🔐" title="Juster rettigheder" onClick={() => setValgtRolle(rolle)} className="text-blue-700" />
                            <IconButton icon="👥" title="Se brugere" onClick={() => navigate('/brugere')} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Magt for rollen: {valgtRolle || '—'}</h3>
              <button onClick={gemRettigheder} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm">Gem rettigheder</button>
            </div>
            {aktivConfig.__meta.parentRole && (
              <label className="flex items-center gap-2 text-sm mb-3 border rounded-lg px-3 py-2 bg-gray-50">
                <input
                  type="checkbox"
                  checked={!!aktivConfig.__meta.canManageUnderRole}
                  onChange={(e) => setPermissions((prev) => ({
                    ...prev,
                    [valgtRolle]: { ...aktivConfig, __meta: { ...aktivConfig.__meta, canManageUnderRole: e.target.checked } }
                  }))}
                />
                Gør ansvarlig for (Rolle)
              </label>
            )}

            <div className="space-y-3">
              {synligeRettigheder.map((node) => (
                <div key={node.id} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setAabenNode(aabenNode === node.id ? null : node.id)} className="text-sm font-medium">{node.label}</button>
                  </div>
                  {aabenNode === node.id && (
                    <div className="mt-2 space-y-2">
                      {node.rights.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={(aktivConfig.rights || []).includes(r)} onChange={() => toggleRight(r)} />
                          <span>{r}</span>
                        </label>
                      ))}
                      {(node.children || []).map((child) => (
                        <div key={child.id} className="ml-4 mt-2 border-l pl-3">
                          <span className="text-sm">{child.label}</span>
                          <div className="space-y-1 mt-1">
                            {child.rights.map((r) => (
                              <label key={r} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={(aktivConfig.rights || []).includes(r)} onChange={() => toggleRight(r)} />
                                <span>{r}</span>
                              </label>
                            ))}
                          </div>
                        </div>
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
