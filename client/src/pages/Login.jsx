import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout] = useState('');
  const [laden, setLaden] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFout('');
    setLaden(true);
    try {
      await login(email, wachtwoord);
      navigate('/');
    } catch {
      setFout('Onjuiste inloggegevens. Probeer opnieuw.');
    } finally {
      setLaden(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo/Titel */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-antraciet-800 tracking-tight">
            PA Atelier
          </h1>
          <p className="font-sans text-sm text-gray-400 mt-2 tracking-widest uppercase">
            Influencer Management
          </p>
        </div>

        {/* Formulier */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">E-mailadres</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jouw@email.nl"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Wachtwoord</label>
              <input
                type="password"
                className="input"
                value={wachtwoord}
                onChange={e => setWachtwoord(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {fout && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {fout}
              </p>
            )}

            <button
              type="submit"
              disabled={laden}
              className="btn-primair w-full text-center disabled:opacity-50"
            >
              {laden ? 'Inloggen...' : 'Inloggen'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} PA Atelier
        </p>
      </div>
    </div>
  );
}
