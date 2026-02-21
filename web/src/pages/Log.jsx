import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function formatTid(iso) {
  return new Date(iso).toLocaleString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Log() {
  const navigate = useNavigate();
  const { bruger, token } = useAuth();
  const [visning, setVisning] = useState('flag-red');
  const [roedeFlag, setRoedeFlag] = useState([]);
  const [brugere, setBrugere] = useState([]);
  const [valgtBruger, setValgtBruger] = useState(null);
  const [brugerLog, setBrugerLog] = useState([]);
  const [rolleLog, setRolleLog] = useState([]);
  const [afventende, setAfventende] = useState([]);
  const [loader, setLoader] = useState(false);
  const [hideAdminSee, setHideAdminSee] = useState(true);

  const erAdmin = bruger?.myndigheder?.some(m => m.rolle === 'Admin' || m.rolle === 'Owner');

  useEffect(() => {
    if (!erAdmin) return;
    hentRoedeFlag();
    hentBrugere();
    hentRolleLog();
    hentVerify();
  }, [erAdmin]);

  async function hentRoedeFlag() {
    const svar = await fetch('/api/admin/roedt-flag', { headers: { 'x-auth-token': token } });
    if (svar.ok) setRoedeFlag(await svar.json());
  }

  async function hentBrugere() {
    const svar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
    if (svar.ok) setBrugere(await svar.json());
  }

  async function hentVerify() {
    const svar = await fetch('/api/admin/afventer', { headers: { 'x-auth-token': token } });
    if (svar.ok) setAfventende(await svar.json());
  }

  async function hentRolleLog() {
    const svar = await fetch('/api/admin/log/roller', { headers: { 'x-auth-token': token } });
    if (svar.ok) setRolleLog(await svar.json());
  }

  async function hentBrugerLog(userId) {
    setValgtBruger(userId);
    setLoader(true);
    const svar = await fetch(`/api/admin/log/${userId}`, { headers: { 'x-auth-token': token } });
    if (svar.ok) setBrugerLog(await svar.json());
    setLoader(false);
  }

  if (!bruger || !erAdmin) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-600">Kun administratorer har adgang</p></div>;

  const filtreretLog = hideAdminSee ? brugerLog.filter(l => !String(l.handling).startsWith('ADMIN_SE_')) : brugerLog;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate('/kontrolpanel')} className="text-gray-500 hover:text-gray-700 text-sm mb-4">← Tilbage</button>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Log</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setVisning('flag-red')} className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm">🚩 Røde flag ({roedeFlag.length})</button>
          <button onClick={() => setVisning('flag-yellow')} className="px-3 py-2 rounded-xl bg-yellow-500 text-white text-sm">🟡 Gule flag (0)</button>
          <button onClick={() => setVisning('flag-gray')} className="px-3 py-2 rounded-xl bg-gray-500 text-white text-sm">⚪ Grå flag (0)</button>
          <button onClick={() => setVisning('bruger')} className="px-3 py-2 rounded-xl bg-gray-800 text-white text-sm">👤 Bruger-log</button>
          <button onClick={() => setVisning('rolle')} className="px-3 py-2 rounded-xl bg-indigo-700 text-white text-sm">🧾 Rolle-log</button>
          <button onClick={() => setVisning('verify')} className="px-3 py-2 rounded-xl bg-green-700 text-white text-sm">✅ Verify ({afventende.length})</button>
        </div>

        {visning === 'flag-red' && <div className="space-y-3">{roedeFlag.map(flag => <div key={flag.id} className="bg-white rounded-xl border border-red-200 p-4"><p className="font-semibold text-red-700">🚩 {flag.grund}</p><p className="text-xs text-gray-500">{flag.user?.navn} · {formatTid(flag.tidspunkt)}</p><p className="text-xs text-gray-400 mt-2">Flag kan først lukkes når sagen er slettet eller annulleret.</p></div>)}</div>}
        {visning === 'flag-yellow' && <div className="bg-white rounded-xl border p-6 text-sm text-gray-500">Gule flag er tilføjet visuelt, men endnu uden funktion.</div>}
        {visning === 'flag-gray' && <div className="bg-white rounded-xl border p-6 text-sm text-gray-500">Grå flag er tilføjet visuelt, men endnu uden funktion.</div>}

        {visning === 'verify' && <div className="space-y-3">{afventende.map(a => <div key={a.id} className="bg-white rounded-xl border p-4"><p className="font-medium">{a.navn}</p><p className="text-xs text-gray-500">{a.email}</p></div>)}</div>}

        {visning === 'rolle' && <div className="space-y-2">{rolleLog.map((entry) => <div key={entry.id} className="bg-white rounded-xl border p-3 text-sm flex justify-between"><div><span className="font-medium">{entry.user?.navn || entry.userId}</span> · {entry.handling}</div><span className="text-xs text-gray-400">{formatTid(entry.tidspunkt)}</span></div>)}</div>}

        {visning === 'bruger' && (
          <div className="flex gap-5">
            <div className="w-56 shrink-0 space-y-1">{brugere.map(b => <button key={b.id} onClick={() => hentBrugerLog(b.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${valgtBruger === b.id ? 'bg-gray-800 text-white' : 'bg-white border'}`}>{b.navn}</button>)}</div>
            <div className="flex-1">
              <button onClick={() => setHideAdminSee(prev => !prev)} className="mb-3 px-3 py-1.5 rounded-lg text-xs border bg-white">Filter: skjul "Admin Se" ({hideAdminSee ? 'til' : 'fra'})</button>
              {loader ? <p>Henter...</p> : <div className="space-y-2">{filtreretLog.map(l => <div key={l.id} className="bg-white border rounded-xl p-3 text-sm flex justify-between"><span>{l.handling}</span><span className="text-xs text-gray-400">{formatTid(l.tidspunkt)}</span></div>)}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
