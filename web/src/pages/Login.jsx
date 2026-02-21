// src/pages/Login.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [kode, setKode] = useState('');
  const [visKode, setVisKode] = useState(false);
  const [fejl, setFejl] = useState('');
  const [loader, setLoader] = useState(false);

  async function indsend(e) {
    e.preventDefault();
    setFejl('');
    setLoader(true);

    try {
      const svar = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), kode })
      });

      const data = await svar.json();

      if (!svar.ok) {
        setFejl(data.fejl || 'Noget gik galt');
      } else {
        login(data.token, data.bruger);
        navigate('/kontrolpanel');
      }
    } catch {
      setFejl('Kunne ikke forbinde til serveren. Prøv igen.');
    } finally {
      setLoader(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="mb-6">
          <button
            onClick={() => navigate('/kontrolpanel')}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4"
          >
            ← Tilbage
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Login</h1>
          <p className="text-gray-500 text-sm mt-1">Log ind med dit e-mailadresse og kode</p>
        </div>

        <form
          onSubmit={indsend}
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 space-y-5"
        >
          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFejl(''); }}
              placeholder="navn@eksempel.dk"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Kode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kode
            </label>
            <div className="relative">
              <input
                type={visKode ? 'text' : 'password'}
                value={kode}
                onChange={e => { setKode(e.target.value); setFejl(''); }}
                placeholder="Din kode"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-16"
              />
              <button
                type="button"
                onClick={() => setVisKode(!visKode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {visKode ? 'Skjul' : 'Vis'}
              </button>
            </div>
          </div>

          {/* Fejl */}
          {fejl && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {fejl}
            </div>
          )}

          {/* Indsend */}
          <button
            type="submit"
            disabled={loader}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {loader ? 'Logger ind...' : 'Log ind'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Ingen konto endnu?{' '}
            <button
              type="button"
              onClick={() => navigate('/kontrolpanel/opret')}
              className="text-green-700 hover:underline font-medium"
            >
              Opret konto her
            </button>
          </p>
        </form>

      </div>
    </div>
  );
}
