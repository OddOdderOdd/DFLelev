// src/pages/OpretKonto.jsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';

// ─── Config storage nøgle ─────────────────────────────────────────────────────
const CONFIG_KEY = 'dfl_opret_config';

const DEFAULT_CONFIG = {
  aaargange: [],
  kollegier: [],
  myndigheder: [
    { id: 'm_admin', label: 'Admin', intern: true },
    { id: 'm_owner', label: 'Owner', intern: true },
  ],
};

function loadConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function persistConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function nyId() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

// ─── Drag-og-slip liste ───────────────────────────────────────────────────────

function DragListe({ items, onReorder, renderItem }) {
  const [fraIdx, setFraIdx] = useState(null);
  const [tilIdx, setTilIdx] = useState(null);

  function dragSlut() {
    if (fraIdx !== null && tilIdx !== null && fraIdx !== tilIdx) {
      const ny = [...items];
      const [el] = ny.splice(fraIdx, 1);
      ny.splice(tilIdx, 0, el);
      onReorder(ny);
    }
    setFraIdx(null);
    setTilIdx(null);
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setFraIdx(idx)}
          onDragEnter={() => setTilIdx(idx)}
          onDragEnd={dragSlut}
          onDragOver={e => e.preventDefault()}
          className={`rounded-lg transition-all ${
            fraIdx === idx ? 'opacity-40' : ''
          } ${tilIdx === idx && fraIdx !== idx ? 'ring-2 ring-blue-400' : ''}`}
        >
          {renderItem(item, idx)}
        </div>
      ))}
    </div>
  );
}

// ─── Admin Konfig Panel ───────────────────────────────────────────────────────

function AdminKonfig({ config, onChange }) {
  const [fane, setFane] = useState('aaargange');
  const [redigerId, setRedigerId] = useState(null);
  const [redigerLabel, setRedigerLabel] = useState('');

  // Tilføj-felt state per fane
  const [nytLabel, setNytLabel] = useState('');
  const [startAar, setStartAar] = useState('');
  const [slutAar, setSlutAar] = useState('');

  function opdaterListe(liste, nyItems) {
    const ny = { ...config, [liste]: nyItems };
    onChange(ny);
  }

  function startRediger(item) {
    setRedigerId(item.id);
    setRedigerLabel(item.label);
  }
  function gemRediger(liste) {
    opdaterListe(liste, config[liste].map(x =>
      x.id === redigerId ? { ...x, label: redigerLabel } : x
    ));
    setRedigerId(null);
    setRedigerLabel('');
  }
  function annullerRediger() {
    setRedigerId(null);
    setRedigerLabel('');
  }
  function slet(liste, id) {
    opdaterListe(liste, config[liste].filter(x => x.id !== id));
  }

  // ── Årgange ──
  function tilfoejAargang() {
    if (startAar && slutAar) {
      const label = `${startAar.trim()}–${slutAar.trim()}`;
      opdaterListe('aaargange', [{ id: nyId(), label }, ...config.aaargange]);
      setStartAar(''); setSlutAar('');
    } else if (nytLabel.trim()) {
      opdaterListe('aaargange', [{ id: nyId(), label: nytLabel.trim() }, ...config.aaargange]);
      setNytLabel('');
    }
  }

  // ── Kollegie / Myndigheder ──
  function tilfoejElement(liste, erOverskrift = false) {
    if (!nytLabel.trim()) return;
    const ny = { id: nyId(), label: nytLabel.trim() };
    if (erOverskrift) ny.erOverskrift = true;
    opdaterListe(liste, [...config[liste], ny]);
    setNytLabel('');
  }

  const faner = [
    { key: 'aaargange',   emoji: '📅', label: 'Årgange' },
    { key: 'kollegier',   emoji: '🏠', label: 'Kollegier' },
    { key: 'myndigheder', emoji: '🏛️', label: 'Myndigheder' },
  ];

  return (
    <div className="border-2 border-amber-400 bg-amber-50 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-amber-700 font-bold text-sm">⚙️ Admin — Rediger formularindstillinger</span>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Ændringer gemmes automatisk</span>
      </div>

      {/* Faner */}
      <div className="flex gap-2 mb-4">
        {faner.map(f => (
          <button key={f.key} type="button" onClick={() => { setFane(f.key); setNytLabel(''); setStartAar(''); setSlutAar(''); setRedigerId(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${fane === f.key ? 'bg-amber-500 text-white' : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'}`}>
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {/* ── Årgange ── */}
      {fane === 'aaargange' && (
        <div>
          <p className="text-xs text-amber-700 mb-3">Tilføj enkelt år eller et spænd (fx 2020–2022). Træk 〓 for at sortere.</p>

          {/* Tilføj-felt */}
          <div className="bg-white border border-amber-200 rounded-xl p-3 mb-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input value={nytLabel} onChange={e => setNytLabel(e.target.value)}
                placeholder="Enkelt label, fx 2026"
                className="flex-1 border border-amber-200 rounded-lg px-3 py-1.5 text-sm" />
              <button type="button" onClick={tilfoejAargang}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                + Tilføj
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-amber-600 w-14 shrink-0">Eller spænd:</span>
              <input value={startAar} onChange={e => setStartAar(e.target.value)} placeholder="Start" type="number"
                className="w-20 border border-amber-200 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-amber-500 font-bold">–</span>
              <input value={slutAar} onChange={e => setSlutAar(e.target.value)} placeholder="Slut" type="number"
                className="w-20 border border-amber-200 rounded-lg px-2 py-1.5 text-sm" />
              <button type="button" onClick={tilfoejAargang}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                + Spænd
              </button>
            </div>
          </div>

          <DragListe
            items={config.aaargange}
            onReorder={items => opdaterListe('aaargange', items)}
            renderItem={item => (
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="text-gray-300 cursor-grab select-none text-base">〓</span>
                {redigerId === item.id ? (
                  <>
                    <input value={redigerLabel} onChange={e => setRedigerLabel(e.target.value)} autoFocus
                      className="flex-1 border border-amber-300 rounded px-2 py-0.5 text-sm" />
                    <button type="button" onClick={() => gemRediger('aaargange')} className="text-green-600 font-bold text-sm">✓</button>
                    <button type="button" onClick={annullerRediger} className="text-gray-400 text-sm">✕</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{item.label}</span>
                    <button type="button" onClick={() => startRediger(item)} className="text-blue-500 text-xs hover:underline">Rediger</button>
                    <button type="button" onClick={() => slet('aaargange', item.id)} className="text-red-400 text-xs hover:underline">Slet</button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* ── Kollegier og Myndigheder (samme layout) ── */}
      {(fane === 'kollegier' || fane === 'myndigheder') && (() => {
        const liste = fane;
        return (
          <div>
            <p className="text-xs text-amber-700 mb-3">
              Træk 〓 for at sortere. Brug <strong>+ Overskrift</strong> til at tilføje sektionsnavne som "Hovedbygningen".
            </p>

            <div className="bg-white border border-amber-200 rounded-xl p-3 mb-3 flex gap-2 flex-wrap">
              <input value={nytLabel} onChange={e => setNytLabel(e.target.value)}
                placeholder="Nyt element..." onKeyDown={e => e.key === 'Enter' && tilfoejElement(liste)}
                className="flex-1 min-w-[160px] border border-amber-200 rounded-lg px-3 py-1.5 text-sm" />
              <button type="button" onClick={() => tilfoejElement(liste, false)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                + Mulighed
              </button>
              <button type="button" onClick={() => tilfoejElement(liste, true)}
                className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                + Overskrift
              </button>
            </div>

            <DragListe
              items={config[liste]}
              onReorder={items => opdaterListe(liste, items)}
              renderItem={item => (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${
                  item.erOverskrift
                    ? 'bg-amber-100 border-amber-400 font-semibold'
                    : 'bg-white border-amber-200'
                }`}>
                  <span className="text-gray-300 cursor-grab select-none text-base">〓</span>
                  {item.erOverskrift && <span className="text-amber-600 text-xs">📁</span>}
                  {redigerId === item.id ? (
                    <>
                      <input value={redigerLabel} onChange={e => setRedigerLabel(e.target.value)} autoFocus
                        className="flex-1 border border-amber-300 rounded px-2 py-0.5 text-sm" />
                      <button type="button" onClick={() => gemRediger(liste)} className="text-green-600 font-bold text-sm">✓</button>
                      <button type="button" onClick={annullerRediger} className="text-gray-400 text-sm">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm truncate">{item.label}</span>
                      {item.erOverskrift && <span className="text-xs text-amber-600 bg-amber-200 px-1.5 py-0.5 rounded-full shrink-0">Overskrift</span>}
                      {item.intern && <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full shrink-0">Intern</span>}
                      <button type="button" onClick={() => startRediger(item)} className="text-blue-500 text-xs hover:underline shrink-0">Rediger</button>
                      <button type="button" onClick={() => slet(liste, item.id)} className="text-red-400 text-xs hover:underline shrink-0">Slet</button>
                    </>
                  )}
                </div>
              )}
            />
          </div>
        );
      })()}
    </div>
  );
}

// ─── Hoved-komponent ─────────────────────────────────────────────────────────

export default function OpretKonto() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin(); // Bruger den eksisterende Admin-knap i navigationen
  const { bruger, token } = useAuth();

  const [config, setConfig] = useState(loadConfig);
  const [rolleMuligheder, setRolleMuligheder] = useState([]);

  const [form, setForm] = useState({
    navn: '', kaldenavn: '', email: '', kode: '', gentag_kode: '',
    aargang: '', kollegie: '', kollegie_andet: '',
    myndigheder: [], note: ''
  });
  const [fejl, setFejl] = useState('');
  const [succes, setSucces] = useState(false);
  const [sender, setSender] = useState(false);
  const [visKode, setVisKode] = useState(false);

  function opdaterConfig(nyConfig) {
    setConfig(nyConfig);
    persistConfig(nyConfig);
  }

  function sætFelt(felt, val) {
    setForm(prev => ({ ...prev, [felt]: val }));
    setFejl('');
  }

  function toggleMyndighed(id) {
    setForm(prev => ({
      ...prev,
      myndigheder: prev.myndigheder.includes(id)
        ? prev.myndigheder.filter(m => m !== id)
        : [...prev.myndigheder, id]
    }));
  }


  useEffect(() => {
    fetch('/api/auth/roller')
      .then(r => r.ok ? r.json() : [])
      .then((roller) => setRolleMuligheder((roller || []).filter((r) => r !== 'Admin' && r !== 'Owner')))
      .catch(() => setRolleMuligheder([]));
  }, []);

  // Byg kollegie dropdown fra config
  function bygDropdown() {
    const grupper = {};
    const rod = [];
    config.kollegier.forEach(k => {
      if (k.erOverskrift) { grupper[k.id] = { label: k.label, items: [] }; }
      else if (k.gruppe && grupper[k.gruppe]) { grupper[k.gruppe].items.push(k); }
      else { rod.push(k); }
    });
    return { rod, grupper };
  }

  // Myndigheder hentes fra backend-roller, så nye kasser vises alle steder
  function bygMyndigheder() {
    return rolleMuligheder.length > 0
      ? [{ titel: 'Myndigheder', items: rolleMuligheder.map((r) => ({ id: r, label: r })) }]
      : [];
  }

  const { rod: kolRod, grupper: kolGrupper } = bygDropdown();
  const myndSektioner = bygMyndigheder();



  const [profilForm, setProfilForm] = useState({
    navn: bruger?.navn || '',
    kaldenavn: bruger?.kaldenavn || '',
    email: bruger?.email || ''
  });
  const [kodeForm, setKodeForm] = useState({ nuvaerende: '', ny: '', gentag: '' });

  async function opdaterProfil() {
    const svar = await fetch('/api/auth/profil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(profilForm)
    });

    const data = await svar.json();
    if (!svar.ok) {
      setFejl(data.fejl || 'Kunne ikke opdatere profil');
      return;
    }

    setFejl('');
    alert('Profil opdateret. Genindlæs siden for at se opdateret sessionsdata.');
  }

  async function anmodSletKonto() {
    const ok = window.confirm('Er du sikker på at du vil anmode om sletning af din konto?');
    if (!ok) return;

    const svar = await fetch('/api/auth/slet-konto', {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    const data = await svar.json();
    if (!svar.ok) return setFejl(data.fejl || 'Kunne ikke sende slet-anmodning');

    alert(data.besked);
  }

  async function skiftKode() {
    if (kodeForm.ny.length < 6) return setFejl('Ny kode skal være mindst 6 tegn');
    if (kodeForm.ny !== kodeForm.gentag) return setFejl('Nye koder matcher ikke');
    const svar = await fetch('/api/auth/skift-kode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(kodeForm)
    });
    const data = await svar.json();
    if (!svar.ok) return setFejl(data.fejl || 'Kunne ikke ændre kode');
    setKodeForm({ nuvaerende: '', ny: '', gentag: '' });
    alert('Kode ændret.');
  }

  async function indsend(e) {
    e.preventDefault();
    setFejl('');
    if (!form.navn.trim())    return setFejl('Angiv venligst dit fulde navn');
    if (!form.kaldenavn.trim()) return setFejl('Angiv venligst et kaldenavn');
    if (!form.email.trim()) return setFejl('Angiv venligst din e-mailadresse');
    if (!form.aargang)        return setFejl('Vælg venligst din årgang');
    if (!form.kollegie)       return setFejl('Vælg venligst dit kollegie');
    if (!form.kode)           return setFejl('Vælg venligst en kode');
    if (form.kode.length < 6) return setFejl('Koden skal være mindst 6 tegn');
    if (form.kode !== form.gentag_kode) return setFejl('Koderne matcher ikke');

    setSender(true);
    try {
      const svar = await fetch('/api/auth/opret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navn: form.navn.trim(),
          kaldenavn: form.kaldenavn.trim(),
          email: form.email.trim(),
          kode: form.kode,
          gentag_kode: form.gentag_kode,
          aargang: form.aargang,
          kollegie: form.kollegie,
          kollegie_andet: form.kollegie_andet,
          myndigheder: form.myndigheder.map(id => ({ rolle: id })),
          note: form.note,
        })
      });
      const data = await svar.json();
      if (!svar.ok) setFejl(data.fejl || 'Noget gik galt');
      else setSucces(true);
    } catch {
      setFejl('Kunne ikke forbinde til serveren');
    } finally {
      setSender(false);
    }
  }


  if (bruger) return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => navigate('/kontrolpanel')} className="text-gray-500 hover:text-gray-700 text-sm">← Tilbage</button>
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h1 className="text-2xl font-bold mb-4">Se profil</h1>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p><strong>Navn:</strong> {bruger.navn}</p>
            <p><strong>Kaldenavn:</strong> {bruger.kaldenavn || '—'}</p>
            <p><strong>E-mail:</strong> {bruger.email}</p>
            <p><strong>Årgang:</strong> {bruger.aargang || '—'}</p>
            <p><strong>Kollegie:</strong> {bruger.kollegie || '—'}</p>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Roller/Myndigheder</p>
            <div className="flex flex-wrap gap-2">
              {(bruger.myndigheder || []).map((m, i) => <span key={i} className="text-xs bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{m.rolle}</span>)}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold mb-2">Rediger profil</h2>
          <p className="text-xs text-gray-500 mb-3">Kaldenavnet er navnet andre ser dig som. Det behøver ikke være dit rigtige navn.</p>
          <div className="grid gap-2">
            <input value={profilForm.navn} onChange={e => setProfilForm(prev => ({ ...prev, navn: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="Navn" />
            <input value={profilForm.kaldenavn} onChange={e => setProfilForm(prev => ({ ...prev, kaldenavn: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="Kaldenavn" />
            <input type="email" value={profilForm.email} onChange={e => setProfilForm(prev => ({ ...prev, email: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="E-mail" />
          </div>
          <button onClick={opdaterProfil} className="mt-3 bg-green-700 text-white px-4 py-2 rounded-xl text-sm">Gem profil</button>
          <button onClick={anmodSletKonto} className="mt-3 ml-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl text-sm">Slet konto</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold mb-2">Ændr kode</h2>
          <div className="grid gap-2">
            <input type="password" value={kodeForm.nuvaerende} onChange={e => setKodeForm(prev => ({ ...prev, nuvaerende: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="Nuværende kode" />
            <input type="password" value={kodeForm.ny} onChange={e => setKodeForm(prev => ({ ...prev, ny: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="Ny kode" />
            <input type="password" value={kodeForm.gentag} onChange={e => setKodeForm(prev => ({ ...prev, gentag: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" placeholder="Gentag ny kode" />
          </div>
          <button onClick={skiftKode} className="mt-3 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm">Gem ny kode</button>
        </div>

        {fejl && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm">{fejl}</div>}
      </div>
    </div>
  );

  if (succes) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ansøgning sendt!</h2>
        <p className="text-gray-600 mb-6">Din konto afventer godkendelse af en administrator.</p>
        <button onClick={() => navigate('/kontrolpanel')}
          className="bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-800 transition-colors">
          Tilbage til kontrolpanel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm mb-4 flex items-center gap-1">
            ← Tilbage
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Opret Konto</h1>
          <p className="text-gray-500 mt-1 text-sm">Din konto aktiveres, når en administrator godkender den.</p>
        </div>

        {/* Admin konfig — vises kun når Admin-knappen er aktiv */}
        {isAdmin && <AdminKonfig config={config} onChange={opdaterConfig} />}

        <form onSubmit={indsend} className="space-y-6">

          {/* ── Profiloplysninger (grundoplysninger + profil i ét) ── */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-5 text-lg">Profiloplysninger</h2>

            {/* Fulde navn */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fulde navn – der fremgår på Viggo eller afgangsbillederne <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.navn} onChange={e => sætFelt('navn', e.target.value)}
                placeholder="Fornavn Efternavn"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
            </div>

            {/* Kaldenavn */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kaldenavn <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.kaldenavn} onChange={e => sætFelt('kaldenavn', e.target.value)}
                placeholder="Navnet andre ser"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              <p className="text-xs text-gray-500 mt-1">Kaldenavnet er det navn andre brugere kommer til at se dig som.</p>
            </div>

            {/* E-mail */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input type="email" value={form.email} onChange={e => sætFelt('email', e.target.value)}
                placeholder="navn@eksempel.dk"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
            </div>

            {/* Kode */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type={visKode ? 'text' : 'password'} value={form.kode}
                  onChange={e => sætFelt('kode', e.target.value)} placeholder="Mindst 6 tegn"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-16" />
                <button type="button" onClick={() => setVisKode(!visKode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {visKode ? 'Skjul' : 'Vis'}
                </button>
              </div>
            </div>

            {/* Gentag kode */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gentag kode <span className="text-red-500">*</span>
              </label>
              <input type={visKode ? 'text' : 'password'} value={form.gentag_kode}
                onChange={e => sætFelt('gentag_kode', e.target.value)} placeholder="Skriv koden igen"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                  form.gentag_kode && form.kode !== form.gentag_kode
                    ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-green-500'}`} />
              {form.gentag_kode && form.kode !== form.gentag_kode && (
                <p className="text-red-500 text-xs mt-1">Koderne matcher ikke</p>
              )}
            </div>

            <hr className="border-gray-100 mb-6" />

            {/* Årgang */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Årgang <span className="text-red-500">*</span>
              </label>
              <select value={form.aargang} onChange={e => sætFelt('aargang', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent">
                <option value="">Vælg årgang</option>
                {config.aaargange.map(a => (
                  <option key={a.id} value={a.label}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Kollegie */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kollegie <span className="text-red-500">*</span>
              </label>
              <select value={form.kollegie} onChange={e => sætFelt('kollegie', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent">
                <option value="">Vælg kollegie</option>
                {kolRod.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                {Object.entries(kolGrupper).map(([gid, g]) =>
                  g.items.length > 0 && (
                    <optgroup key={gid} label={g.label}>
                      {g.items.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </optgroup>
                  )
                )}
              </select>
              {form.kollegie && config.kollegier.find(k => k.id === form.kollegie)?.harAndet && (
                <input type="text" value={form.kollegie_andet}
                  onChange={e => sætFelt('kollegie_andet', e.target.value)}
                  placeholder="Skriv dit kollegie her..."
                  className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus />
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea value={form.note} onChange={e => sætFelt('note', e.target.value)}
                placeholder="Valgfri besked til administratoren..."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y" />
            </div>
          </section>

          {/* ── Myndigheder ── */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="font-semibold text-gray-800 mb-1 text-lg">Myndigheder</h2>
            <p className="text-xs text-gray-500 mb-5">Valgfrit — vælg en eller flere. Kræver godkendelse.</p>
            <div className="space-y-5">
              {myndSektioner.map((sek, idx) => (
                <div key={idx}>
                  {sek.titel && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{sek.titel}</p>
                  )}
                  <div className="space-y-2">
                    {sek.items.map(m => {
                      const valgt = form.myndigheder.includes(m.id);
                      return (
                        <label key={m.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            valgt ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={valgt} onChange={() => toggleMyndighed(m.id)}
                            className="accent-green-600" />
                          <span className="text-sm text-gray-800">
                            {m.label}
                            {m.intern && (
                              <span className="ml-2 text-xs text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">Kræver admin</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {fejl && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{fejl}</div>
          )}

          <button type="submit" disabled={sender}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sender ? 'Sender ansøgning...' : 'Opret konto'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Har du allerede en konto?{' '}
            <button type="button" onClick={() => navigate('/kontrolpanel/login')}
              className="text-green-700 hover:underline font-medium">
              Log ind her
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
