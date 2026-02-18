// src/pages/Brugere.jsx
// Admin-side: se og rediger alle brugere
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const KOLLEGIE_LABELS = {
  andet: 'Andet', oensker_ikke: 'Ønsker ikke at svare',
  ikke_relevant: 'Ikke skole-relevant', brantsminde: 'Brantsminde',
  hoved_stue: 'Hoved – Stue', hoved_1sal: 'Hoved – 1. sal',
  hoved_2sal: 'Hoved – 2. sal', HA: '(HA) Himmerigsgården A',
  HB: '(HB) Himmerigsgården B', hugin: 'Hugin', munin: 'Munin',
  aeble: 'Æblegården', bakkehuset: 'Bakkehuset', toften: 'Toften',
  plantagen: 'Plantagen', boghandlen: 'Boghandlen', mindedal: '(Mindedal)',
};

function rolleBadgeKlasse(rolle) {
  if (rolle === 'Owner') return 'bg-purple-100 text-purple-800';
  if (rolle === 'Admin') return 'bg-yellow-100 text-yellow-800';
  return 'bg-blue-50 text-blue-700';
}

export default function Brugere() {
  const navigate = useNavigate();
  const { bruger: mig, token } = useAuth();

  const [brugere, setBrugere]       = useState([]);
  const [loader, setLoader]         = useState(true);
  const [søgning, setSøgning]       = useState('');
  const [filter, setFilter]         = useState('alle'); // alle | aktive | afventende | inaktive
  const [redigerBruger, setRedigerBruger] = useState(null);
  const [besked, setBesked]         = useState('');
  const [gemmer, setGemmer]         = useState(false);

  const erAdmin = mig?.myndigheder?.some(m =>
    m.rolle === 'Admin' || m.rolle === 'Owner'
  );

  useEffect(() => {
    if (!erAdmin) return;
    hentBrugere();
  }, [erAdmin]);

  async function hentBrugere() {
    setLoader(true);
    try {
      const svar = await fetch('/api/admin/brugere', {
        headers: { 'x-auth-token': token },
      });
      if (svar.ok) setBrugere(await svar.json());
    } catch {
      setBesked('Fejl ved hentning af brugere');
    } finally {
      setLoader(false);
    }
  }

  async function gemRedigering() {
    if (!redigerBruger) return;
    setGemmer(true);
    try {
      const svar = await fetch(`/api/admin/bruger/${redigerBruger.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({
          kollegie:   redigerBruger.kollegie,
          aargang:    redigerBruger.aargang,
          note:       redigerBruger.note,
          aktiv:      redigerBruger.aktiv,
          myndigheder: redigerBruger.myndigheder,
        }),
      });
      if (svar.ok) {
        setBesked('✅ Bruger opdateret');
        setRedigerBruger(null);
        await hentBrugere();
      } else {
        const data = await svar.json();
        setBesked(`❌ ${data.fejl || 'Fejl ved opdatering'}`);
      }
    } catch {
      setBesked('❌ Serverfejl');
    } finally {
      setGemmer(false);
    }
  }

  function tilføjRolle(rolle) {
    if (!rolle.trim()) return;
    if (redigerBruger.myndigheder.some(m => m.rolle === rolle)) return;
    setRedigerBruger(prev => ({
      ...prev,
      myndigheder: [...prev.myndigheder, { rolle, note: '' }],
    }));
  }

  function fjernRolle(rolle) {
    setRedigerBruger(prev => ({
      ...prev,
      myndigheder: prev.myndigheder.filter(m => m.rolle !== rolle),
    }));
  }

  // Filter + søg
  const visteBrugere = brugere.filter(b => {
    const matcherSøgning = !søgning ||
      b.navn.toLowerCase().includes(søgning.toLowerCase()) ||
      b.telefon.includes(søgning);
    const matcherFilter =
      filter === 'alle'       ? true :
      filter === 'aktive'     ? (b.aktiv && !b.afventerGodkendelse) :
      filter === 'afventende' ? b.afventerGodkendelse :
      filter === 'inaktive'   ? (!b.aktiv && !b.afventerGodkendelse) : true;
    return matcherSøgning && matcherFilter;
  });

  if (!mig || !erAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Kun administratorer har adgang</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4"
          >
            ← Tilbage
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Brugerstyring</h1>
              <p className="text-gray-500 text-sm mt-1">{brugere.length} brugere i alt</p>
            </div>
          </div>
        </div>

        {besked && (
          <div className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
            besked.startsWith('✅')
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {besked}
            <button onClick={() => setBesked('')} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Søg + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Søg navn eller telefon..."
            value={søgning}
            onChange={e => setSøgning(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            {['alle', 'aktive', 'afventende', 'inaktive'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f === 'alle'       ? `Alle (${brugere.length})` :
                 f === 'aktive'     ? `Aktive (${brugere.filter(b => b.aktiv && !b.afventerGodkendelse).length})` :
                 f === 'afventende' ? `Afventende (${brugere.filter(b => b.afventerGodkendelse).length})` :
                                     `Inaktive (${brugere.filter(b => !b.aktiv && !b.afventerGodkendelse).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Brugerliste */}
        {loader ? (
          <div className="text-center py-16 text-gray-400">Henter brugere...</div>
        ) : visteBrugere.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center text-gray-400">
            Ingen brugere matcher søgningen
          </div>
        ) : (
          <div className="space-y-3">
            {visteBrugere.map(b => (
              <div
                key={b.id}
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  b.afventerGodkendelse
                    ? 'border-yellow-200'
                    : b.aktiv
                    ? 'border-gray-200'
                    : 'border-red-100 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-gray-900">{b.navn}</h2>
                      {b.afventerGodkendelse && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                          ⏳ Afventer
                        </span>
                      )}
                      {!b.aktiv && !b.afventerGodkendelse && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Inaktiv
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{b.telefon}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(b.myndigheder || []).map((m, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${rolleBadgeKlasse(m.rolle)}`}
                        >
                          {m.rolle}
                        </span>
                      ))}
                      {b.myndigheder?.length === 0 && (
                        <span className="text-xs text-gray-400 italic">Ingen roller</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/kontrolpanel/log?bruger=${b.id}`)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      📋 Log
                    </button>
                    <button
                      onClick={() => setRedigerBruger({ ...b, myndigheder: b.myndigheder || [] })}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ✏ Rediger
                    </button>
                  </div>
                </div>

                {/* Ekstra detaljer */}
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  {b.aargang && <span>Årgang: {b.aargang}</span>}
                  {b.kollegie && <span>{KOLLEGIE_LABELS[b.kollegie] || b.kollegie}</span>}
                  <span>Oprettet: {new Date(b.oprettet).toLocaleDateString('da-DK')}</span>
                  {b._count && (
                    <>
                      <span>{b._count.uploadedFiles} filer</span>
                      {b._count.redFlags > 0 && (
                        <span className="text-red-500 font-medium">🚩 {b._count.redFlags} flag</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rediger Modal ── */}
      {redigerBruger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">✏ Rediger: {redigerBruger.navn}</h2>

            {/* Aktiv toggle */}
            <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm font-medium text-gray-700">Konto aktiv</span>
              <button
                onClick={() => setRedigerBruger(prev => ({ ...prev, aktiv: !prev.aktiv }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  redigerBruger.aktiv ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  redigerBruger.aktiv ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Roller */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Roller</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {redigerBruger.myndigheder.map((m, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${rolleBadgeKlasse(m.rolle)}`}
                  >
                    {m.rolle}
                    <button
                      onClick={() => fjernRolle(m.rolle)}
                      className="hover:opacity-60 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  id="ny-rolle-input"
                  type="text"
                  placeholder="Ny rolle (f.eks. Undergrunden)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      tilføjRolle(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('ny-rolle-input');
                    tilføjRolle(input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Tryk Enter eller + for at tilføje</p>
            </div>

            {/* Aargang */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Årgang</label>
              <input
                type="text"
                value={redigerBruger.aargang || ''}
                onChange={e => setRedigerBruger(prev => ({ ...prev, aargang: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Note */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                value={redigerBruger.note || ''}
                onChange={e => setRedigerBruger(prev => ({ ...prev, note: e.target.value }))}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={gemRedigering}
                disabled={gemmer}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {gemmer ? 'Gemmer...' : 'Gem'}
              </button>
              <button
                onClick={() => setRedigerBruger(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-xl font-medium text-sm"
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
