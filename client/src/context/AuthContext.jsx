import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [gebruiker, setGebruiker] = useState(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pa_token');
    if (token) {
      api.get('/auth/mij')
        .then(r => setGebruiker(r.data))
        .catch(() => localStorage.removeItem('pa_token'))
        .finally(() => setLaden(false));
    } else {
      setLaden(false);
    }
  }, []);

  async function login(email, wachtwoord) {
    const r = await api.post('/auth/login', { email, wachtwoord });
    localStorage.setItem('pa_token', r.data.token);
    setGebruiker(r.data.gebruiker);
    return r.data.gebruiker;
  }

  function uitloggen() {
    localStorage.removeItem('pa_token');
    setGebruiker(null);
  }

  const isPA       = gebruiker?.rol === 'pa';
  const isStaff    = gebruiker?.rol === 'staff';
  const isInfluencer = gebruiker?.rol === 'influencer';

  return (
    <AuthContext.Provider value={{ gebruiker, laden, login, uitloggen, isPA, isStaff, isInfluencer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
