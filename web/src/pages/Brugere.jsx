import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hoejesteRolleNiveau, rolleNiveau } from '../utils/roleHierarchy';

const KOLLEGIER = ['', 'brantsminde', 'hugin', 'munin', 'toften', 'plantagen'];

export default function Brugere() {
  const navigate = useNavigate();
  const { bruger: mig, token } = useAuth();
  const [brugere, setBrugere] = useState([]);
  const [redigerBruger, setRedigerBruger] = useState(null);
  const [roller, setRoller] = useState(['Medlem', 'Næstforperson', 'Forperson', 'Admin', 'Owner']);

  const erAdmin = mig?.myndigheder?.some(m => m.rolle === 'Admin' || m.rolle === 'Owner');

  useEffect(() => {
    if (!erAdmin) return;
    (async () => {
      const svar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
      if (svar.ok) {
        const data = await svar.json();
        setBrugere(data);
        const alle = new Set(roller);
        data.forEach(u => (u.myndigheder || []).forEach(m => alle.add(m.rolle)));
        setRoller([...alle]);
      }
    })();
  }, [erAdmin]);

  const mitNiveau = hoejesteRolleNiveau(mig?.myndigheder || []);
  const synligeBrugere = brugere.filter(b => {
    const niveau = hoejesteRolleNiveau(b.myndigheder || []);
    return niveau < mitNiveau || b.id === mig.id;
  });

  async function gem() {
    const svar = await fetch(`/api/admin/bruger/${redigerBruger.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(redigerBruger)
    });
    if (svar.ok) {
      setRedigerBruger(null);
      const nysvar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
      if (nysvar.ok) setBrugere(await nysvar.json());
    }
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
                <p className="font-semibold">{b.navn}</p>
                <p className="text-xs text-gray-500">{b.email}</p>
              </div>
              <button onClick={() => setRedigerBruger({ ...b, navn: b.navn || '', email: b.email || '', aargang: b.aargang || '', kollegie: b.kollegie || '', myndigheder: b.myndigheder || [] })} className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm">Rediger</button>
            </div>
          ))}
        </div>
      </div>

      {redigerBruger && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-xl font-bold">Rediger bruger</h2>
            <input value={redigerBruger.navn} onChange={e => setRedigerBruger(prev => ({ ...prev, navn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Navn" />
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
            <select
              value={redigerBruger.myndigheder?.[0]?.rolle || ''}
              onChange={e => setRedigerBruger(prev => ({ ...prev, myndigheder: e.target.value ? [{ rolle: e.target.value }] : [] }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Vælg rolle</option>
              {roller.filter(r => rolleNiveau(r) < mitNiveau).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
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
