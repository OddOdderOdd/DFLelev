import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CONFIG_KEY = 'dfl_opret_config';

const RETTIGHEDS_TRAE = [
  {
    id: 'home',
    label: 'Hjem',
    rights: ['side:home'],
    children: []
  },
  {
    id: 'kontrolpanel',
    label: 'Kontrolpanel',
    rights: ['side:kontrolpanel', 'kp:log', 'kp:verify', 'kp:brugere', 'kp:rettigheder'],
    children: []
  },
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
  {
    id: 'skolekort',
    label: 'Skolekort',
    rights: ['side:skolekort'],
    children: []
  },
  {
    id: 'ressourcer',
    label: 'Ressourcer',
    rights: ['side:ressourcer', 'ressourcer:edit'],
    children: [
      { id: 'ressourcer:mapper', label: 'Mapper & undermapper', rights: ['ressourcer:folder:edit', 'ressourcer:folder:create', 'ressourcer:folder:delete'] }
    ]
  },
  {
    id: 'arkiv',
    label: 'Arkiv',
    rights: ['side:arkiv', 'arkiv:edit'],
    children: [
      { id: 'arkiv:mapper', label: 'Mapper & undermapper', rights: ['arkiv:folder:edit', 'arkiv:folder:create', 'arkiv:folder:delete'] }
    ]
  }
];

function loadConfig() {
  return { aaargange: [], kollegier: [], myndigheder: [{ id: 'm_admin', label: 'Admin', intern: true }, { id: 'm_owner', label: 'Owner', intern: true }] };
}

export default function RettighederAdmin() {
  const navigate = useNavigate();
  const { bruger, erAdmin, token } = useAuth();
  const [fane, setFane] = useState('myndigheder');
  const [config, setConfig] = useState(loadConfig());
  const [roller, setRoller] = useState([]);
  const [valgtRolle, setValgtRolle] = useState('');
  const [permissions, setPermissions] = useState({});
  const [brugere, setBrugere] = useState([]);
  const [soeg, setSoeg] = useState('');
  const [nyMyndighed, setNyMyndighed] = useState('');
  const [aabenNode, setAabenNode] = useState(null);

  const aktivConfig = permissions[valgtRolle] || { rights: [], ansvarlige: [] };

  useEffect(() => {
    if (!erAdmin) return;

    (async () => {
      const [rollerSvar, rettighederSvar, brugereSvar] = await Promise.all([
        fetch('/api/auth/roller'),
        fetch('/api/admin/rettigheder', { headers: { 'x-auth-token': token } }),
        fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } })
      ]);

      if (rollerSvar.ok) {
        const data = await rollerSvar.json();
        setRoller(data);
        if (!valgtRolle && data.length > 0) setValgtRolle(data[0]);
      }

      if (rettighederSvar.ok) {
        const data = await rettighederSvar.json();
        const normalized = {};
        Object.entries(data).forEach(([rolle, rett]) => {
          normalized[rolle] = Array.isArray(rett) ? { rights: rett, ansvarlige: [] } : { rights: rett.rights || [], ansvarlige: rett.ansvarlige || [] };
        });
        setPermissions(normalized);
      }

      if (brugereSvar.ok) {
        const data = await brugereSvar.json();
        setBrugere(data);
      }
    })();
  }, [erAdmin, token]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const filtreredeBrugere = useMemo(() => {
    const q = soeg.toLowerCase().trim();
    if (!q) return brugere.slice(0, 20);
    return brugere.filter((b) => (b.kaldenavn || b.navn || '').toLowerCase().includes(q)).slice(0, 20);
  }, [soeg, brugere]);

  function opdaterListe(key, items) {
    setConfig(prev => ({ ...prev, [key]: items }));
  }

  async function opretMyndighed() {
    const navn = nyMyndighed.trim();
    if (!navn) return;

    const svar = await fetch('/api/admin/roller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ navn })
    });

    if (!svar.ok) return;

    const rollerSvar = await fetch('/api/auth/roller');
    if (rollerSvar.ok) {
      const data = await rollerSvar.json();
      setRoller(data);
      if (!config.myndigheder.some(m => m.label === navn)) {
        opdaterListe('myndigheder', [...config.myndigheder, { id: `m_${Date.now()}`, label: navn }]);
      }
      setValgtRolle(navn);
    }

    setNyMyndighed('');
  }

  function toggleRight(right) {
    const cur = new Set(aktivConfig.rights || []);
    if (cur.has(right)) cur.delete(right); else cur.add(right);
    setPermissions(prev => ({ ...prev, [valgtRolle]: { ...aktivConfig, rights: [...cur] } }));
  }

  function toggleAnsvarlig(userId) {
    const cur = new Set(aktivConfig.ansvarlige || []);
    if (cur.has(userId)) cur.delete(userId); else cur.add(userId);
    setPermissions(prev => ({ ...prev, [valgtRolle]: { ...aktivConfig, ansvarlige: [...cur] } }));
  }

  async function gemRettigheder() {
    const payload = { ...permissions };
    await fetch('/api/auth/admin/rettigheder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(payload)
    });
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun admin/owner har adgang.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500">← Tilbage</button>
        <h1 className="text-3xl font-bold">Rettigheder & Roller</h1>
        <p className="text-sm text-gray-500">Roller = Årgang, Kollegie og Myndighed. Fanen “Rettigheder” er slettet.</p>

        <div className="flex gap-2 flex-wrap">
          {['aaargange', 'kollegie', 'myndigheder'].map(t => (
            <button key={t} onClick={() => setFane(t)} className={`px-3 py-1.5 rounded-lg text-sm ${fane === t ? 'bg-gray-900 text-white' : 'bg-white border'}`}>{t}</button>
          ))}
        </div>

        {fane !== 'myndigheder' && (
          <div className="bg-white rounded-2xl border p-5">
            <textarea
              className="w-full min-h-56 border rounded-xl p-3 text-sm font-mono"
              value={JSON.stringify(fane === 'aaargange' ? config.aaargange : config.kollegier, null, 2)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  opdaterListe(fane === 'aaargange' ? 'aaargange' : 'kollegier', parsed);
                } catch {}
              }}
            />
          </div>
        )}

        {fane === 'myndigheder' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <div className="flex gap-2">
                <input value={nyMyndighed} onChange={e => setNyMyndighed(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Opret myndighed, fx Undergrunden" />
                <button onClick={opretMyndighed} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Opret kasse</button>
              </div>

              <select value={valgtRolle} onChange={e => setValgtRolle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {roller.filter(r => r !== 'Admin' && r !== 'Owner').map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <h3 className="font-semibold">Ansvarlige brugere (søg på kaldenavn)</h3>
              <input value={soeg} onChange={e => setSoeg(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Søg kaldenavn" />
              <div className="max-h-56 overflow-auto border rounded-lg">
                {filtreredeBrugere.map(b => (
                  <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0">
                    <input type="checkbox" checked={(aktivConfig.ansvarlige || []).includes(b.id)} onChange={() => toggleAnsvarlig(b.id)} />
                    <span>{b.kaldenavn || b.navn}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Magt for rollen: {valgtRolle || '—'}</h3>
                <button onClick={gemRettigheder} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm">Gem rettigheder</button>
              </div>

              <div className="space-y-3">
                {RETTIGHEDS_TRAE.map((node) => (
                  <div key={node.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setAabenNode(aabenNode === node.id ? null : node.id)} className="text-sm font-medium">{node.label}</button>
                      <button onClick={() => node.rights.forEach(toggleRight)} className="text-sm">⚙️</button>
                    </div>

                    {aabenNode === node.id && (
                      <div className="mt-2 space-y-2">
                        {node.rights.map((r) => (
                          <label key={r} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={(aktivConfig.rights || []).includes(r)} onChange={() => toggleRight(r)} />
                            <span>{r}</span>
                          </label>
                        ))}

                        {node.children?.map((child) => (
                          <div key={child.id} className="ml-4 mt-2 border-l pl-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{child.label}</span>
                              <button onClick={() => child.rights.forEach(toggleRight)} className="text-sm">⚙️</button>
                            </div>
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
        )}
      </div>
    </div>
  );
}
