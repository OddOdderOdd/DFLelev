// src/context/AuthContext.jsx
// Global auth state + rettighedssystem

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// ─── Alle kendte rettigheder i systemet ──────────────────────────────────────
// En rettighed er en streng der refererer til en bestemt del af systemet.
// Owner og Admin arver ALLE rettigheder automatisk.

export const ALLE_RETTIGHEDER = [
  // Sider
  { id: 'side:arkiv',         label: 'Side: Arkiv',         gruppe: 'Sider' },
  { id: 'side:ressourcer',    label: 'Side: Ressourcer',    gruppe: 'Sider' },
  { id: 'side:mindmap',       label: 'Side: Mindmap',       gruppe: 'Sider' },
  { id: 'side:skolekort',     label: 'Side: Skolekort',     gruppe: 'Sider' },
  // Kontrolpanel
  { id: 'kp:verify',          label: 'Kontrolpanel: Verify (godkend konti)',  gruppe: 'Kontrolpanel' },
  { id: 'kp:log',             label: 'Kontrolpanel: Log (aktivitetslog)',     gruppe: 'Kontrolpanel' },
  { id: 'kp:brugere',         label: 'Kontrolpanel: Brugerstyring',          gruppe: 'Kontrolpanel' },
  { id: 'kp:rettigheder',     label: 'Kontrolpanel: Rettigheds-admin',       gruppe: 'Kontrolpanel' },
  // Fil-handlinger
  { id: 'fil:upload',         label: 'Filer: Upload',       gruppe: 'Filer' },
  { id: 'fil:slet',           label: 'Filer: Slet',         gruppe: 'Filer' },
  { id: 'fil:opret-mappe',    label: 'Filer: Opret mapper', gruppe: 'Filer' },
  // Fremtidige sektioner tilføjes her
];

export function AuthProvider({ children }) {
  const [bruger, setBruger]           = useState(null);
  const [token, setToken]             = useState(null);
  const [loader, setLoader]           = useState(true);
  // rolleRettigheder: { "Undergrunden": ["kp:log", "side:arkiv"], ... }
  const [rolleRettigheder, setRolleRettigheder] = useState({});

  // ── Hent session + rettigheder ved opstart ────────────────────────────────
  useEffect(() => {
    const gemmtToken  = localStorage.getItem('dfl_token');
    const gemmtBruger = localStorage.getItem('dfl_bruger');

    // Hent rettigheder fra server (kræver ikke login)
    fetch('/api/auth/rettigheder')
      .then(r => r.ok ? r.json() : {})
      .then(data => setRolleRettigheder(data))
      .catch(() => {});

    if (gemmtToken && gemmtBruger) {
      setToken(gemmtToken);
      setBruger(JSON.parse(gemmtBruger));

      fetch('/api/auth/mig', { headers: { 'x-auth-token': gemmtToken } })
        .then(svar => {
          if (!svar.ok) {
            localStorage.removeItem('dfl_token');
            localStorage.removeItem('dfl_bruger');
            setToken(null); setBruger(null);
          } else return svar.json();
        })
        .then(data => {
          if (data) {
            setBruger(data);
            localStorage.setItem('dfl_bruger', JSON.stringify(data));
          }
        })
        .catch(() => {})
        .finally(() => setLoader(false));
    } else {
      setLoader(false);
    }
  }, []);

  function login(nytToken, brugerData) {
    setToken(nytToken);
    setBruger(brugerData);
    localStorage.setItem('dfl_token', nytToken);
    localStorage.setItem('dfl_bruger', JSON.stringify(brugerData));
  }

  async function logout() {
    if (token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-auth-token': token } });
      } catch {}
    }
    setToken(null); setBruger(null);
    localStorage.removeItem('dfl_token');
    localStorage.removeItem('dfl_bruger');
  }

  // ── Hjælpefunktioner ─────────────────────────────────────────────────────

  const erAdmin = bruger?.myndigheder?.some(m =>
    m.rolle === 'Admin' || m.rolle === 'Owner'
  );

  // Returnerer alle rettigheds-id'er som den aktuelle bruger har
  // Owner/Admin har ALLE rettigheder
  function brugerensRettigheder() {
    if (!bruger) return new Set();
    if (erAdmin) return new Set(ALLE_RETTIGHEDER.map(r => r.id));

    const ret = new Set();
    (bruger.myndigheder || []).forEach(m => {
      const rolleRet = rolleRettigheder[m.rolle] || [];
      rolleRet.forEach(r => ret.add(r));
    });
    return ret;
  }

  // Tjek om bruger har en bestemt rettighed
  function harRettighed(rettighedId) {
    if (!bruger) return false;
    if (erAdmin) return true; // Owner/Admin har alt
    return brugerensRettigheder().has(rettighedId);
  }

  // Tjek om bruger har NOGEN af en liste af rettigheder
  function harEnAfRettigheder(rettighedsIds) {
    return rettighedsIds.some(r => harRettighed(r));
  }

  return (
    <AuthContext.Provider value={{
      bruger, token, loader,
      login, logout,
      erAdmin,
      harRettighed,
      harEnAfRettigheder,
      rolleRettigheder,
      setRolleRettigheder,
      brugerensRettigheder,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth skal bruges inden for AuthProvider');
  return ctx;
}
