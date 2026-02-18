// src/pages/Log.jsx
// Admin-side: aktivitetslog og røde flag for alle brugere
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HANDLING_LABELS = {
  LOGIN:                   { label: 'Login',                    farve: 'text-green-700 bg-green-50' },
  LOGOUT:                  { label: 'Logout',                   farve: 'text-gray-600 bg-gray-50' },
  MISLYKKET_LOGIN:         { label: 'Mislykket login',          farve: 'text-yellow-700 bg-yellow-50' },
  RØDT_FLAG:               { label: '🚩 Rødt flag',             farve: 'text-red-700 bg-red-50 font-bold' },
  KONTO_ANSOEGNING:        { label: 'Konto-ansøgning',          farve: 'text-blue-700 bg-blue-50' },
  KONTO_GODKENDT:          { label: 'Konto godkendt',           farve: 'text-green-700 bg-green-50' },
  OPRET_ADMIN:             { label: 'Admin oprettet',           farve: 'text-purple-700 bg-purple-50' },
  ADMIN_SE_AFVENTENDE:     { label: 'Admin: Se afventende',     farve: 'text-purple-700 bg-purple-50' },
  ADMIN_GODKENDT_KONTO:    { label: 'Admin: Godkendt konto',    farve: 'text-purple-700 bg-purple-50' },
  ADMIN_AFVIST_KONTO:      { label: 'Admin: Afvist konto',      farve: 'text-orange-700 bg-orange-50' },
  ADMIN_SE_BRUGERE:        { label: 'Admin: Se brugere',        farve: 'text-purple-700 bg-purple-50' },
  ADMIN_SE_LOG:            { label: 'Admin: Se log',            farve: 'text-purple-700 bg-purple-50' },
  ADMIN_REDIGERET_BRUGER:  { label: 'Admin: Redigerede bruger', farve: 'text-purple-700 bg-purple-50' },
  ADMIN_SE_ROEDT_FLAG:     { label: 'Admin: Se røde flag',      farve: 'text-purple-700 bg-purple-50' },
  ADMIN_OPDATER_RETTIGHEDER: { label: 'Admin: Opdaterede rettigheder', farve: 'text-purple-700 bg-purple-50' },
  SIDEBESØG:               { label: 'Sidebesøg',               farve: 'text-gray-600 bg-gray-50' },
};

function HandlingBadge({ handling }) {
  const info = HANDLING_LABELS[handling] || { label: handling, farve: 'text-gray-600 bg-gray-50' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.farve}`}>
      {info.label}
    </span>
  );
}

function formatTid(iso) {
  return new Date(iso).toLocaleString('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Log() {
  const navigate = useNavigate();
  const { bruger, token } = useAuth();
  const [visning, setVisning] = useState('flag');
  const [roedeFlag, setRoedeFlag] = useState([]);
  const [brugere, setBrugere] = useState([]);
  const [valgtBruger, setValgtBruger] = useState(null);
  const [brugerLog, setBrugerLog] = useState([]);
  const [loader, setLoader] = useState(false);

  const erAdmin = bruger?.myndigheder?.some(m =>
    m.rolle === 'Admin' || m.rolle === 'Owner'
  );

  useEffect(() => {
    if (!erAdmin) return;
    hentRoedeFlag();
    hentBrugere();
  }, [erAdmin]);

  async function hentRoedeFlag() {
    setLoader(true);
    try {
      // KORREKT sti: /api/admin/*
      const svar = await fetch('/api/admin/roedt-flag', {
        headers: { 'x-auth-token': token },
      });
      if (svar.ok) setRoedeFlag(await svar.json());
    } finally {
      setLoader(false);
    }
  }

  async function hentBrugere() {
    try {
      const svar = await fetch('/api/admin/brugere', {
        headers: { 'x-auth-token': token },
      });
      if (svar.ok) setBrugere(await svar.json());
    } catch {}
  }

  async function hentBrugerLog(userId) {
    setValgtBruger(userId);
    setLoader(true);
    try {
      const svar = await fetch(`/api/admin/log/${userId}`, {
        headers: { 'x-auth-token': token },
      });
      if (svar.ok) {
        const log = await svar.json();
        setBrugerLog(log); // Backend returnerer allerede nyeste først
      }
    } finally {
      setLoader(false);
    }
  }

  async function resolverFlag(flagId) {
    try {
      const svar = await fetch(`/api/admin/roedt-flag/${flagId}/resolve`, {
        method: 'PUT',
        headers: { 'x-auth-token': token },
      });
      if (svar.ok) {
        setRoedeFlag(prev => prev.filter(f => f.id !== flagId));
      }
    } catch {}
  }

  if (!bruger || !erAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Kun administratorer har adgang</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4"
          >
            ← Tilbage
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Log</h1>
          <p className="text-gray-500 text-sm mt-1">
            Aktivitetslog og røde flag.
          </p>
        </div>

        {/* Faner */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setVisning('flag')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              visning === 'flag'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            🚩 Røde flag ({roedeFlag.length})
          </button>
          <button
            onClick={() => setVisning('bruger')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              visning === 'bruger'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            👤 Bruger-log
          </button>
        </div>

        {/* ── Røde flag ── */}
        {visning === 'flag' && (
          <div>
            {loader ? (
              <div className="text-center py-10 text-gray-400">Henter...</div>
            ) : roedeFlag.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-600">Ingen røde flag — alt er roligt</p>
              </div>
            ) : (
              <div className="space-y-3">
                {roedeFlag.map((flag) => (
                  <div key={flag.id} className="bg-white rounded-2xl p-5 shadow-sm border border-red-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 font-bold text-sm">🚩 Rødt flag</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {flag.user?.navn || flag.userId}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTid(flag.tidspunkt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium mb-1">{flag.grund}</p>
                    {flag.detaljer && (
                      <pre className="text-xs bg-gray-50 rounded-lg p-2 mt-2 text-gray-600 overflow-x-auto">
                        {typeof flag.detaljer === 'string'
                          ? flag.detaljer
                          : JSON.stringify(flag.detaljer, null, 2)}
                      </pre>
                    )}
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => { setVisning('bruger'); hentBrugerLog(flag.userId); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Se fuld log →
                      </button>
                      <button
                        onClick={() => resolverFlag(flag.id)}
                        className="text-xs text-green-600 hover:underline"
                      >
                        ✓ Marker løst
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bruger-log ── */}
        {visning === 'bruger' && (
          <div className="flex gap-5">
            <div className="w-56 shrink-0">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3 font-semibold">
                Brugere ({brugere.length})
              </p>
              <div className="space-y-1">
                {brugere.map(b => (
                  <button
                    key={b.id}
                    onClick={() => hentBrugerLog(b.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      valgtBruger === b.id
                        ? 'bg-gray-800 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium truncate">{b.navn}</div>
                    <div className="text-xs opacity-60 truncate">{b.telefon}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              {!valgtBruger ? (
                <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center text-gray-400 text-sm">
                  Vælg en bruger til venstre
                </div>
              ) : loader ? (
                <div className="text-center py-10 text-gray-400">Henter log...</div>
              ) : brugerLog.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center text-gray-500">
                  Ingen log for denne bruger
                </div>
              ) : (
                <div className="space-y-2">
                  {brugerLog.map((entry, i) => (
                    <div
                      key={i}
                      className={`bg-white rounded-xl px-4 py-3 border text-sm flex items-start justify-between gap-3 ${
                        entry.handling === 'RØDT_FLAG' ? 'border-red-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <HandlingBadge handling={entry.handling} />
                        {entry.detaljer && (
                          <span className="text-gray-500 truncate text-xs">
                            {typeof entry.detaljer === 'string'
                              ? entry.detaljer
                              : Object.entries(
                                  typeof entry.detaljer === 'string'
                                    ? JSON.parse(entry.detaljer)
                                    : entry.detaljer
                                )
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' · ')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {formatTid(entry.tidspunkt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
