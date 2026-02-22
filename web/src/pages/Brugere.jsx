import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hoejesteRolleNiveau } from '../utils/roleHierarchy';

const KOLLEGIER = ['', 'brantsminde', 'hugin', 'munin', 'toften', 'plantagen'];

export default function Brugere() {
  const navigate = useNavigate();
  const { bruger: mig, token } = useAuth();
  const [brugere, setBrugere] = useState([]);
  const [redigerBruger, setRedigerBruger] = useState(null);
  const [roller, setRoller] = useState(['Admin', 'Owner']);
  const [fejl, setFejl] = useState('');

  const erAdmin = mig?.myndigheder?.some(m => m.rolle === 'Admin' || m.rolle === 'Owner');

  useEffect(() => {
    if (!erAdmin) return;
    (async () => {
      const svar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
      if (svar.ok) {
        const data = await svar.json();
        setBrugere(data);
      }

      const rollerSvar = await fetch('/api/auth/roller');
      if (rollerSvar.ok) {
        const roleData = await rollerSvar.json();
        setRoller(roleData);
      }
    })();
  }, [erAdmin]);

  const synligeBrugere = brugere.filter(b => {
    const niveau = hoejesteRolleNiveau(b.myndigheder || []);
    const mitNiveau = hoejesteRolleNiveau(mig?.myndigheder || []);
    return niveau < mitNiveau || b.id === mig.id;
  });

  async function gem() {
    setFejl('');
    const svar = await fetch(`/api/admin/bruger/${redigerBruger.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(redigerBruger)
    });
    if (svar.ok) {
      setRedigerBruger(null);
      const nysvar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
      if (nysvar.ok) setBrugere(await nysvar.json());
      return;
    }

    const data = await svar.json().catch(() => ({}));
    setFejl(data.fejl || 'Kunne ikke gemme ændringer.');
  }

  if (!erAdmin) return <div className="min-h-screen flex items-center justify-center">Kun administratorer har adgang</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate('/kontrolpanel')} className="text-sm text-gray-500 mb-4">← Tilbage</button>
        <h1 className="text-3xl font-bold mb-5">Brugerstyring</h1>
        <p className="text-sm text-gray-500 mb-4">Viser kun brugere under dit hierarki.</p>
        <div className="space-y-2">
          {synligeBrugere.map(b => (
            <div key={b.id} className="bg-white border rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{b.kaldenavn || b.navn}</p>
                <p className="text-xs text-gray-500">{b.email}</p>
              </div>
              <button onClick={() => setRedigerBruger({ ...b, navn: b.navn || '', kaldenavn: b.kaldenavn || '', email: b.email || '', aargang: b.aargang || '', kollegie: b.kollegie || '', myndigheder: b.myndigheder || [] })} className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm">Rediger</button>
            </div>
          ))}
        </div>
      </div>

      {redigerBruger && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-xl font-bold">Rediger bruger</h2>
            <input value={redigerBruger.navn} onChange={e => setRedigerBruger(prev => ({ ...prev, navn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Navn" />
            <input value={redigerBruger.kaldenavn || ''} onChange={e => setRedigerBruger(prev => ({ ...prev, kaldenavn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Kaldenavn" />
            <input value={redigerBruger.email} onChange={e => setRedigerBruger(prev => ({ ...prev, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="E-mail" />
            <select value={redigerBruger.aargang || ''} onChange={e => setRedigerBruger(prev => ({ ...prev, aargang: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Vælg årgang</option>
              {Array.from({ length: 70 }).map((_, i) => {
                const aar = new Date().getFullYear() - i;
                return <option key={aar} value={String(aar)}>{aar}</option>;
              })}
            </select>
            <select value={redigerBruger.kollegie || ''} onChange={e => setRedigerBruger(prev => ({ ...prev, kollegie: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
              {KOLLEGIER.map(k => <option key={k} value={k}>{k || 'Vælg kollegie'}</option>)}
            </select>
            <div className="border rounded-lg p-2 max-h-40 overflow-auto">
              <p className="text-xs text-gray-500 mb-2">Myndigheder</p>
              <div className="space-y-1">
                {roller.map((r) => {
                  const valgt = (redigerBruger.myndigheder || []).some((m) => m.rolle === r);
                  return (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={valgt}
                        onChange={() => {
                          setRedigerBruger((prev) => {
                            const eksisterende = prev.myndigheder || [];
                            if (valgt) {
                              return { ...prev, myndigheder: eksisterende.filter((m) => m.rolle !== r) };
                            }
                            return { ...prev, myndigheder: [...eksisterende, { rolle: r }] };
                          });
                        }}
                      />
                      {r}
                    </label>
                  );
                })}
              </div>
            </div>
            {fejl && <p className="text-sm text-red-600">{fejl}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={gem} className="flex-1 bg-green-700 text-white rounded-lg py-2 text-sm">Gem</button>
              <button onClick={() => setRedigerBruger(null)} className="flex-1 bg-gray-100 rounded-lg py-2 text-sm">Annuller</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
