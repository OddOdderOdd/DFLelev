// src/pages/Verify.jsx
// Admin-side: godkend eller afvis nye brugeransøgninger
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const KOLLEGIE_LABELS = {
  andet: 'Andet',
  oensker_ikke: 'Ønsker ikke at svare',
  ikke_relevant: 'Ikke skole-relevant',
  brantsminde: 'Brantsminde',
  hoved_stue: 'Hovedbygningen – Stue',
  hoved_1sal: 'Hovedbygningen – 1. sal',
  hoved_2sal: 'Hovedbygningen – 2. sal',
  HA: '(HA) Himmerigsgården A',
  HB: '(HB) Himmerigsgården B',
  hugin: 'Hugin',
  munin: 'Munin',
  aeble: 'Æblegården',
  bakkehuset: 'Bakkehuset',
  toften: 'Toften',
  plantagen: 'Plantagen',
  boghandlen: 'Boghandlen',
  mindedal: '(Mindedal)',
};

export default function Verify() {
  const navigate = useNavigate();
  const { bruger, token } = useAuth();
  const [afventende, setAfventende] = useState([]);
  const [loader, setLoader] = useState(true);
  const [handling, setHandling] = useState(null);
  const [besked, setBesked] = useState('');

  const erAdmin = bruger?.myndigheder?.some(m =>
    m.rolle === 'Admin' || m.rolle === 'Owner'
  );

  useEffect(() => {
    if (!erAdmin) return;
    hentAfventende();
  }, [erAdmin]);

  async function hentAfventende() {
    setLoader(true);
    try {
      // KORREKT sti: /api/admin/* (ikke /api/auth/admin/*)
      const svar = await fetch('/api/admin/afventer', {
        headers: { 'x-auth-token': token }
      });
      const data = await svar.json();
      if (svar.ok) setAfventende(data);
      else setBesked(data.fejl || 'Fejl ved hentning');
    } catch {
      setBesked('Fejl ved hentning af ansøgninger');
    } finally {
      setLoader(false);
    }
  }

  async function godkend(id) {
    setHandling(id);
    try {
      const svar = await fetch(`/api/admin/godkend/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
      });
      const data = await svar.json();
      if (svar.ok) {
        setBesked(data.besked);
        setAfventende(prev => prev.filter(b => b.id !== id));
      } else {
        setBesked(data.fejl || 'Fejl');
      }
    } catch {
      setBesked('Serverfejl');
    } finally {
      setHandling(null);
    }
  }

  async function afvis(id, navn) {
    if (!window.confirm(`Afvis ansøgning fra ${navn}?`)) return;
    setHandling(id);
    try {
      const svar = await fetch(`/api/admin/afvis/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ grund: 'Afvist af admin' }),
      });
      const data = await svar.json();
      if (svar.ok) {
        setBesked(data.besked);
        setAfventende(prev => prev.filter(b => b.id !== id));
      } else {
        setBesked(data.fejl || 'Fejl');
      }
    } catch {
      setBesked('Serverfejl');
    } finally {
      setHandling(null);
    }
  }

  if (!bruger) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Du skal være logget ind som administrator</p>
          <button
            onClick={() => navigate('/kontrolpanel/login')}
            className="bg-green-700 text-white px-5 py-2 rounded-xl"
          >
            Log ind
          </button>
        </div>
      </div>
    );
  }

  if (!erAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600 font-medium">Kun administratorer har adgang til denne side</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4"
          >
            ← Tilbage
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Verify</h1>
          <p className="text-gray-500 text-sm mt-1">Afventende brugeransøgninger</p>
        </div>

        {besked && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm flex justify-between items-center">
            {besked}
            <button onClick={() => setBesked('')} className="text-green-600 hover:text-green-800">✕</button>
          </div>
        )}

        {loader ? (
          <div className="text-center py-16 text-gray-400">Henter ansøgninger...</div>
        ) : afventende.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-gray-600 font-medium">Ingen afventende ansøgninger</p>
          </div>
        ) : (
          <div className="space-y-4">
            {afventende.map(ans => (
              <div key={ans.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{ans.navn}</h2>
                    <p className="text-gray-500 text-sm">{ans.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(ans.oprettet).toLocaleString('da-DK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Årgang</span>
                    <p className="text-gray-800">{ans.aargang || '–'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Kollegie</span>
                    <p className="text-gray-800">
                      {KOLLEGIE_LABELS[ans.kollegie] || ans.kollegie || '–'}
                      {ans.kollegie === 'andet' && ans.kollegieAndet && `: ${ans.kollegieAndet}`}
                    </p>
                  </div>
                </div>

                {ans.myndigheder?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Ønsker roller</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ans.myndigheder.map((m, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {m.rolle}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {ans.note && (
                  <div className="mb-4 bg-gray-50 rounded-xl p-3">
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Note</span>
                    <p className="text-gray-700 text-sm mt-0.5">{ans.note}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => godkend(ans.id)}
                    disabled={handling === ans.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {handling === ans.id ? '...' : '✓ Godkend'}
                  </button>
                  <button
                    onClick={() => afvis(ans.id, ans.navn)}
                    disabled={handling === ans.id}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    ✕ Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
