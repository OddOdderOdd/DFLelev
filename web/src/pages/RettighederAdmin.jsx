import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { bruger, erAdmin } = useAuth();
  const [fane, setFane] = useState('myndigheder');
  const [config, setConfig] = useState(loadConfig);
  const [nyMyndighed, setNyMyndighed] = useState('');

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  function opdaterListe(key, items) {
    setConfig(prev => ({ ...prev, [key]: items }));
  }

  function opretMyndighed() {
    const label = nyMyndighed.trim();
    if (!label) return;
    if (config.myndigheder.some(m => m.label.toLowerCase() === label.toLowerCase())) return;

    opdaterListe('myndigheder', [...config.myndigheder, { id: `m_${Date.now()}`, label }]);
    setNyMyndighed('');
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun admin/owner har adgang.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500 mb-4">← Tilbage</button>
        <h1 className="text-3xl font-bold mb-1">Roller</h1>
        <p className="text-sm text-gray-500 mb-5">Fanen “Rettigheder” er udfaset. Roller opdeles nu i Årgange, Kollegier og Myndigheder.</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {['aaargange', 'kollegie', 'myndigheder'].map(t => <button key={t} onClick={() => setFane(t)} className={`px-3 py-1.5 rounded-lg text-sm ${fane === t ? 'bg-gray-900 text-white' : 'bg-white border'}`}>{t}</button>)}
        </div>

        <div className="bg-white rounded-2xl border p-5">
          {fane === 'myndigheder' && (
            <div className="mb-4 flex gap-2">
              <input value={nyMyndighed} onChange={e => setNyMyndighed(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Opret ny myndighed, fx Undergrunden" />
              <button onClick={opretMyndighed} className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm">Opret</button>
            </div>
          )}

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
      </div>
    </div>
  );
}
