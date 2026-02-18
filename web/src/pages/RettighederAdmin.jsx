// src/pages/RettighederAdmin.jsx
// Owner/Admin kan definere hvilke roller der har adgang til hvad + administrere rolle-katalog
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ALLE_RETTIGHEDER } from '../context/AuthContext';

const SYSTEM_ROLLER = ['Admin', 'Owner'];

export default function RettighederAdmin() {
  const navigate = useNavigate();
  const { bruger, erAdmin, token, rolleRettigheder, setRolleRettigheder } = useAuth();

  // Rettigheds-fane state
  const [alleRoller, setAlleRoller]   = useState([]);
  const [lokaleRet, setLokaleRet]     = useState({});
  const [loader, setLoader]           = useState(true);
  const [gemmer, setGemmer]           = useState(false);
  const [besked, setBesked]           = useState('');
  const [valgtRolle, setValgtRolle]   = useState(null);
  const [nyRolle, setNyRolle]         = useState('');

  // Rolle-katalog fane state
  const [fane, setFane]                     = useState('rettigheder');
  const [rolleListe, setRolleListe]         = useState([]);
  const [visSlettede, setVisSlettede]       = useState(false);
  const [rolleLoader, setRolleLoader]       = useState(false);
  const [omdoebId, setOmdoebId]             = useState(null);
  const [omdoebNavn, setOmdoebNavn]         = useState('');
  const [rolleHandling, setRolleHandling]   = useState('');
  const [nyRolleKatalog, setNyRolleKatalog] = useState('');

  useEffect(() => {
    if (!bruger || !erAdmin) return;
    hentData();
    hentRoller();
  }, [bruger]);

  async function hentData() {
    setLoader(true);
    try {
      const bSvar = await fetch('/api/admin/brugere', { headers: { 'x-auth-token': token } });
      const brugere = bSvar.ok ? await bSvar.json() : [];
      const rolleSet = new Set(['Admin', 'Owner']);
      brugere.forEach(b => (b.myndigheder || []).forEach(m => { if (m.rolle) rolleSet.add(m.rolle); }));
      Object.keys(rolleRettigheder).forEach(r => rolleSet.add(r));
      setAlleRoller([...rolleSet].sort());
      const rSvar = await fetch('/api/auth/rettigheder');
      const rettigheder = rSvar.ok ? await rSvar.json() : {};
      setLokaleRet(rettigheder);
    } catch {
      setBesked('Fejl ved hentning af data');
    } finally {
      setLoader(false);
    }
  }

  async function hentRoller() {
    setRolleLoader(true);
    try {
      const svar = await fetch('/api/admin/roller/alle', { headers: { 'x-auth-token': token } });
      if (svar.ok) setRolleListe(await svar.json());
    } catch {
      setRolleHandling('Fejl ved hentning af roller');
    } finally {
      setRolleLoader(false);
    }
  }

  async function syncRoller() {
    setRolleLoader(true); setRolleHandling('');
    try {
      const svar = await fetch('/api/admin/roller/sync', { method: 'POST', headers: { 'x-auth-token': token } });
      const data = await svar.json();
      setRolleHandling(svar.ok ? `✅ ${data.besked}` : `❌ ${data.fejl}`);
      if (svar.ok) { await hentRoller(); await hentData(); }
    } catch { setRolleHandling('❌ Serverfejl'); }
    finally { setRolleLoader(false); }
  }

  async function opretRolleKatalog() {
    if (!nyRolleKatalog.trim()) return;
    setRolleHandling('');
    try {
      const svar = await fetch('/api/admin/roller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ navn: nyRolleKatalog.trim() }),
      });
      const data = await svar.json();
      if (svar.ok) {
        setNyRolleKatalog('');
        setRolleHandling(`✅ Rolle "${data.navn}" oprettet`);
        await hentRoller();
        setAlleRoller(prev => [...new Set([...prev, data.navn])].sort());
      } else {
        setRolleHandling(`❌ ${data.fejl}`);
      }
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  async function gemOmdoeb(id) {
    if (!omdoebNavn.trim()) return;
    setRolleHandling('');
    try {
      const svar = await fetch(`/api/admin/roller/${id}/omdoeb`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ nytNavn: omdoebNavn.trim() }),
      });
      const data = await svar.json();
      if (svar.ok) {
        setRolleHandling(`✅ Rolle omdøbt → "${data.rolle.navn}" (${data.paavirkedebrugere} brugere opdateret)`);
        setOmdoebId(null); setOmdoebNavn('');
        await hentRoller(); await hentData();
      } else { setRolleHandling(`❌ ${data.fejl}`); }
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  async function anmodSlet(id, navn) {
    if (!window.confirm(`Anmod om sletning af "${navn}"?\n\nEn anden administrator skal bekræfte.`)) return;
    setRolleHandling('');
    try {
      const svar = await fetch(`/api/admin/roller/${id}/anmod-slet`, { method: 'POST', headers: { 'x-auth-token': token } });
      const data = await svar.json();
      setRolleHandling(svar.ok ? `⏳ ${data.besked}` : `❌ ${data.fejl}`);
      if (svar.ok) await hentRoller();
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  async function bekraeftSlet(id, navn) {
    if (!window.confirm(`Bekræft sletning af "${navn}"?\n\nSoft-delete — kan gendannes.`)) return;
    setRolleHandling('');
    try {
      const svar = await fetch(`/api/admin/roller/${id}/bekraeft-slet`, { method: 'POST', headers: { 'x-auth-token': token } });
      const data = await svar.json();
      setRolleHandling(svar.ok ? `🗑️ ${data.besked}` : `❌ ${data.fejl}`);
      if (svar.ok) await hentRoller();
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  async function annullerSlet(id) {
    setRolleHandling('');
    try {
      const svar = await fetch(`/api/admin/roller/${id}/annuller-slet`, { method: 'POST', headers: { 'x-auth-token': token } });
      const data = await svar.json();
      setRolleHandling(svar.ok ? '✅ Sletnings-anmodning annulleret' : `❌ ${data.fejl}`);
      if (svar.ok) await hentRoller();
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  async function gendan(id, navn) {
    setRolleHandling('');
    try {
      const svar = await fetch(`/api/admin/roller/${id}/gendan`, { method: 'POST', headers: { 'x-auth-token': token } });
      const data = await svar.json();
      setRolleHandling(svar.ok ? `✅ ${data.besked}` : `❌ ${data.fejl}`);
      if (svar.ok) await hentRoller();
    } catch { setRolleHandling('❌ Serverfejl'); }
  }

  function harRet(rolle, retId) { return (lokaleRet[rolle] || []).includes(retId); }
  function toggleRet(rolle, retId) {
    setLokaleRet(prev => {
      const nuv = prev[rolle] || [];
      const ny = nuv.includes(retId) ? nuv.filter(r => r !== retId) : [...nuv, retId];
      return { ...prev, [rolle]: ny };
    });
  }
  function giveAlle(rolle) { setLokaleRet(prev => ({ ...prev, [rolle]: ALLE_RETTIGHEDER.map(r => r.id) })); }
  function fjernAlle(rolle) { setLokaleRet(prev => ({ ...prev, [rolle]: [] })); }
  function tilfoejNyRolle() {
    const rolle = nyRolle.trim();
    if (!rolle || alleRoller.includes(rolle)) return;
    setAlleRoller(prev => [...prev, rolle].sort());
    setLokaleRet(prev => ({ ...prev, [rolle]: [] }));
    setValgtRolle(rolle);
    setNyRolle('');
  }

  async function gem() {
    setGemmer(true); setBesked('');
    try {
      const svar = await fetch('/api/auth/admin/rettigheder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(lokaleRet),
      });
      if (svar.ok) { setRolleRettigheder(lokaleRet); setBesked('✅ Rettigheder gemt!'); }
      else setBesked('❌ Fejl ved gemning');
    } catch { setBesked('❌ Serverfejl'); }
    finally { setGemmer(false); }
  }

  const grupper = {};
  ALLE_RETTIGHEDER.forEach(r => { if (!grupper[r.gruppe]) grupper[r.gruppe] = []; grupper[r.gruppe].push(r); });

  const aktiveKatalogRoller   = rolleListe.filter(r => !r.slettet);
  const slettedeKatalogRoller = rolleListe.filter(r => r.slettet);
  const afventende            = rolleListe.filter(r => !r.slettet && r.sletAnmodetAf);

  if (!bruger || !erAdmin) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-600">Kun Owner/Admin har adgang til denne side</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <button onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4">
            ← Tilbage
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Rettigheder & Roller</h1>
          <p className="text-gray-500 text-sm mt-1">
            Administrer roller og definer hvilke dele af systemet de kan tilgå.
          </p>
        </div>

        {/* Fane-navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'rettigheder', label: '🔑 Rettigheder', desc: 'Hvad må hvilke roller?' },
            { key: 'roller', label: '🏷️ Rolle-katalog', desc: `${aktiveKatalogRoller.length} aktive${afventende.length ? ` · ${afventende.length} afventer` : ''}` },
          ].map(f => (
            <button key={f.key} onClick={() => setFane(f.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                fane === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
              }`}>
              <div>{f.label}</div>
              <div className={`text-xs mt-0.5 ${fane === f.key ? 'text-gray-300' : 'text-gray-400'}`}>{f.desc}</div>
            </button>
          ))}
        </div>

        {/* ══ FANE: RETTIGHEDER ══ */}
        {fane === 'rettigheder' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-500">Owner og Admin har altid alle rettigheder.</p>
              <button onClick={gem} disabled={gemmer}
                className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
                {gemmer ? 'Gemmer...' : '💾 Gem ændringer'}
              </button>
            </div>

            {besked && (
              <div className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
                besked.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
              }`}>{besked}</div>
            )}

            {loader ? <div className="text-center py-16 text-gray-400">Henter data...</div> : (
              <div className="flex gap-5">
                <div className="w-52 shrink-0">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Roller</p>
                  <div className="space-y-1 mb-3">
                    {alleRoller.map(rolle => {
                      const erSystemrolle = SYSTEM_ROLLER.includes(rolle);
                      const antalRet = erSystemrolle ? ALLE_RETTIGHEDER.length : (lokaleRet[rolle] || []).length;
                      return (
                        <button key={rolle} onClick={() => setValgtRolle(rolle)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                            valgtRolle === rolle ? 'bg-gray-800 text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}>
                          <div className="font-medium truncate">{rolle}</div>
                          <div className={`text-xs mt-0.5 ${valgtRolle === rolle ? 'text-gray-300' : 'text-gray-400'}`}>
                            {erSystemrolle ? '🔒 Alle rettigheder' : `${antalRet} ret.`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1">
                    <input type="text" placeholder="Ny rolle..." value={nyRolle}
                      onChange={e => setNyRolle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && tilfoejNyRolle()}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button onClick={tilfoejNyRolle}
                      className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Roller synkroniseres automatisk fra brugere</p>
                </div>

                <div className="flex-1">
                  {!valgtRolle ? (
                    <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center text-gray-400 text-sm">
                      Vælg en rolle til venstre
                    </div>
                  ) : (() => {
                    const erSystemrolle = SYSTEM_ROLLER.includes(valgtRolle);
                    return (
                      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <h2 className="font-bold text-gray-900 text-lg">{valgtRolle}</h2>
                            {erSystemrolle ? (
                              <p className="text-xs text-purple-600 mt-0.5">🔒 Systemrolle – har automatisk alle rettigheder</p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {(lokaleRet[valgtRolle] || []).length} af {ALLE_RETTIGHEDER.length} rettigheder tildelt
                              </p>
                            )}
                          </div>
                          {!erSystemrolle && (
                            <div className="flex gap-2">
                              <button onClick={() => giveAlle(valgtRolle)}
                                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
                                Vælg alle
                              </button>
                              <button onClick={() => fjernAlle(valgtRolle)}
                                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">
                                Fjern alle
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="divide-y divide-gray-50">
                          {Object.entries(grupper).map(([gruppe, rettigheder]) => (
                            <div key={gruppe} className="px-6 py-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{gruppe}</p>
                              <div className="space-y-2">
                                {rettigheder.map(ret => {
                                  const tildelt = erSystemrolle || harRet(valgtRolle, ret.id);
                                  return (
                                    <label key={ret.id}
                                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                        tildelt ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                                      } ${erSystemrolle ? 'opacity-60 cursor-default' : ''}`}>
                                      <input type="checkbox" checked={tildelt} disabled={erSystemrolle}
                                        onChange={() => !erSystemrolle && toggleRet(valgtRolle, ret.id)}
                                        className="accent-green-600" />
                                      <div>
                                        <p className="text-sm text-gray-800 font-medium">{ret.label}</p>
                                        <p className="text-xs text-gray-400 font-mono">{ret.id}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ FANE: ROLLE-KATALOG ══ */}
        {fane === 'roller' && (
          <div>
            {rolleHandling && (
              <div className={`mb-5 px-4 py-3 rounded-xl text-sm border ${
                rolleHandling.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-800'
                : rolleHandling.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-700'
                : rolleHandling.startsWith('⏳') ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>{rolleHandling}</div>
            )}

            {/* Afventende sletning */}
            {afventende.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-5 mb-6">
                <p className="text-sm font-bold text-yellow-800 mb-3">
                  ⏳ {afventende.length} rolle{afventende.length > 1 ? 'r' : ''} afventer sletnings-bekræftelse
                </p>
                <div className="space-y-2">
                  {afventende.map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-yellow-200 px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-gray-900">{r.navn}</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Anmodet {r.sletAnmodetAt ? new Date(r.sletAnmodetAt).toLocaleString('da-DK') : ''}
                          {r.sletAnmodetAf === bruger?.id && (
                            <span className="ml-2 text-yellow-700 font-medium">(Du anmodede — en ANDEN admin skal bekræfte)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {r.sletAnmodetAf !== bruger?.id && (
                          <button onClick={() => bekraeftSlet(r.id, r.navn)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium">
                            ✅ Bekræft slet
                          </button>
                        )}
                        <button onClick={() => annullerSlet(r.id)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
                          Annuller
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex gap-2 flex-1">
                <input type="text" placeholder="Ny rolle..." value={nyRolleKatalog}
                  onChange={e => setNyRolleKatalog(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && opretRolleKatalog()}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                <button onClick={opretRolleKatalog}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  + Opret rolle
                </button>
              </div>
              <button onClick={syncRoller} disabled={rolleLoader}
                className="text-sm border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl disabled:opacity-50">
                🔄 Sync fra brugere
              </button>
              <button onClick={() => setVisSlettede(v => !v)}
                className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
                  visSlettede ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>
                {visSlettede ? '👁 Skjul slettede' : `🗑️ Vis slettede (${slettedeKatalogRoller.length})`}
              </button>
            </div>

            {/* Aktive roller */}
            {rolleLoader ? (
              <div className="text-center py-10 text-gray-400">Henter roller...</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
                <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Aktive roller ({aktiveKatalogRoller.length})
                  </p>
                </div>
                {aktiveKatalogRoller.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">Ingen aktive roller — klik "Sync fra brugere"</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {aktiveKatalogRoller.map(rolle => (
                      <div key={rolle.id} className="px-6 py-4 flex items-center gap-4">
                        {omdoebId === rolle.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input type="text" value={omdoebNavn} onChange={e => setOmdoebNavn(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') gemOmdoeb(rolle.id); if (e.key === 'Escape') { setOmdoebId(null); setOmdoebNavn(''); } }}
                              autoFocus
                              className="border border-blue-400 rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => gemOmdoeb(rolle.id)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">✓ Gem</button>
                            <button onClick={() => { setOmdoebId(null); setOmdoebNavn(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600">Annuller</button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{rolle.navn}</span>
                              {rolle.sletAnmodetAf && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Afventer sletning</span>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">
                                Oprettet {new Date(rolle.oprettet).toLocaleDateString('da-DK')}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => { setOmdoebId(rolle.id); setOmdoebNavn(rolle.navn); }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
                                ✏️ Omdøb
                              </button>
                              {!rolle.sletAnmodetAf ? (
                                <button onClick={() => anmodSlet(rolle.id, rolle.navn)}
                                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">
                                  🗑️ Anmod slet
                                </button>
                              ) : (
                                <button onClick={() => annullerSlet(rolle.id)}
                                  className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg">
                                  ↩ Annuller
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Slettede roller */}
            {visSlettede && slettedeKatalogRoller.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden opacity-75">
                <div className="px-6 py-3 border-b border-gray-100 bg-red-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                    Slettede roller — kan gendannes ({slettedeKatalogRoller.length})
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {slettedeKatalogRoller.map(rolle => (
                    <div key={rolle.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="flex-1">
                        <span className="font-medium text-gray-500 line-through">{rolle.navn}</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Slettet {rolle.slettetDato ? new Date(rolle.slettetDato).toLocaleDateString('da-DK') : ''}
                        </p>
                      </div>
                      <button onClick={() => gendan(rolle.id, rolle.navn)}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg shrink-0">
                        ↩ Gendan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">ℹ️ Sådan virker rolle-sletning</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Admin A klikker "Anmod slet" — rollen markeres afventende og et rødt flag oprettes</li>
                <li>Admin B (en ANDEN administrator) bekræfter sletningen</li>
                <li>Rollen soft-slettes — forsvinder fra dropdowns men kan gendannes</li>
                <li>Admin/Owner kan til enhver tid klikke "Gendan" for at rulle tilbage</li>
              </ol>
              <p className="mt-2 text-xs text-blue-600">
                <strong>Admin og Owner</strong> er systemroller og administreres ikke her.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
