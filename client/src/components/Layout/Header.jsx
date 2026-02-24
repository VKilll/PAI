import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

const paginaTitels = {
  '/':             'Dashboard',
  '/pakketten':    'Pakketten',
  '/financien':    'Financiën',
  '/reizen':       'Reizen',
  '/content':      'Content Kalender',
  '/briefings':    'Briefings',
  '/research':     'Research',
  '/statistieken': 'Statistieken',
  '/engagement':   'Engagement',
};

export default function Header() {
  const { gebruiker, uitloggen } = useAuth();
  const location = useLocation();
  const titel = paginaTitels[location.pathname] || 'PA Atelier';

  return (
    <header className="bg-white border-b border-cream-200 px-8 py-4 flex items-center justify-between shadow-editorial">
      <h2 className="font-serif text-xl text-antraciet-800">{titel}</h2>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-sans text-sm font-medium text-antraciet-800">{gebruiker?.naam}</p>
          <p className="font-sans text-xs text-gray-400 capitalize">{gebruiker?.rol}</p>
        </div>
        <button
          onClick={uitloggen}
          className="p-2 text-gray-400 hover:text-antraciet-800 hover:bg-cream-100 rounded-editorial transition-colors"
          title="Uitloggen"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
