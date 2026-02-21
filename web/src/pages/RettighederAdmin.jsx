import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ALLE_RETTIGHEDER } from '../context/AuthContext';

const CONFIG_KEY = 'dfl_opret_config';

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { aaargange: [], kollegier: [], myndigheder: [] };
  } catch {
    return { aaargange: [], kollegier: [], myndigheder: [] };
  }
}

export default function RettighederAdmin() {
  const navigate = useNavigate();
  const { bruger, erAdmin, token } = useAuth();
  const [fane, setFane] = useState('rettigheder');
  const [lokaleRet, setLokaleRet] = useState({});
  const [rolle, setRolle] = useState('Admin');
  const [config, setConfig] = useState(loadConfig);

  const roller = useMemo(() => ['Owner', 'Admin', ...config.myndigheder.filter(m => !m.erOverskrift).map(m => m.label)], [config]);

  useEffect(() => {
    if (!erAdmin) return;
    fetch('/api/auth/rettigheder').then(r => r.ok ? r.json() : {}).then(setLokaleRet);
  }, [erAdmin]);

  function toggleRet(ret) {
    const s = new Set(lokaleRet[rolle] || []);
    if (s.has(ret)) s.delete(ret); else s.add(ret);
    setLokaleRet(prev => ({ ...prev, [rolle]: [...s] }));
  }

  async function gemRet() {
    await fetch('/api/auth/admin/rettigheder', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify(lokaleRet)
    });
  }

  function opdaterListe(key, items) {
    const next = { ...config, [key]: items };
    setConfig(next);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun admin/owner har adgang.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500 mb-4">← Tilbage</button>
        <h1 className="text-3xl font-bold mb-1">Rettigheder & Roller</h1>
        <p className="text-sm text-gray-500 mb-5">Ny struktur: Årgange, Kollegie, Myndigheder/Roller.</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {['rettigheder', 'aaargange', 'kollegie', 'myndigheder'].map(t => <button key={t} onClick={() => setFane(t)} className={`px-3 py-1.5 rounded-lg text-sm ${fane === t ? 'bg-gray-900 text-white' : 'bg-white border'}`}>{t}</button>)}
        </div>

        {fane === 'rettigheder' && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex gap-2 mb-4">
              <select value={rolle} onChange={e => setRolle(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                {roller.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={gemRet} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Gem rettigheder</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Owner har alt. Admin starter med alle rettigheder men kan fravælges her.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {ALLE_RETTIGHEDER.map(ret => (
                <label key={ret.id} className="border rounded-lg p-2 text-sm flex gap-2 items-center">
                  <input type="checkbox" checked={(lokaleRet[rolle] || []).includes(ret.id) || rolle === 'Owner'} onChange={() => toggleRet(ret.id)} disabled={rolle === 'Owner'} />
                  <span>{ret.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {fane !== 'rettigheder' && (
          <div className="bg-white rounded-2xl border p-5">
            <p className="text-sm font-medium mb-2">{fane === 'aaargange' ? 'Årgange' : fane === 'kollegie' ? 'Kollegie' : 'Myndigheder/Roller'}</p>
            <textarea
              className="w-full min-h-56 border rounded-xl p-3 text-sm font-mono"
              value={JSON.stringify(
                fane === 'aaargange' ? config.aaargange : fane === 'kollegie' ? config.kollegier : config.myndigheder,
                null,
                2
              )}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  opdaterListe(fane === 'aaargange' ? 'aaargange' : fane === 'kollegie' ? 'kollegier' : 'myndigheder', parsed);
                } catch {}
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
