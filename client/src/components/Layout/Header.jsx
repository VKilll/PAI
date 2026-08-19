import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useInfluencer } from '../../context/InfluencerContext';
import { LogOut, Users } from 'lucide-react';
import NotificatieCentrum from '../Notificaties/NotificatieCentrum';

const paginaTitels = {
  '/':                'Vandaag',
  '/influencers':     'Influencers',
  '/pakketten':       'Pakketten',
  '/samenwerkingen':  'Samenwerkingen',
  '/financien':       'Financiën',
  '/verkoopfacturen': 'Verkoopfacturen',
  '/mijn-facturen':   'Mijn facturen',
  '/berichten':       'Berichten',
  '/reizen':          'Reizen',
  '/content':         'Content Kalender',
  '/briefings':       'Briefings',
  '/research':        'Research',
  '/statistieken':    'Statistieken',
  '/engagement':      'Engagement',
};

// ── Influencer-switch: PA en manager wisselen hier van dossier ──
function InfluencerSwitch() {
  const { influencers, actiefId, kiesInfluencer, magWisselen } = useInfluencer();

  if (!magWisselen || influencers.length === 0) return null;

  return (
    <label className="flex items-center gap-2">
      <Users size={15} className="text-gray-400" />
      <select
        className="input text-sm py-1.5 max-w-[200px]"
        value={actiefId ?? ''}
        onChange={e => kiesInfluencer(e.target.value ? Number(e.target.value) : null)}
        title="Wissel van influencer"
      >
        <option value="">Alle influencers</option>
        {influencers.map(i => (
          <option key={i.id} value={i.id}>{i.naam}</option>
        ))}
      </select>
    </label>
  );
}

export default function Header() {
  const { gebruiker, uitloggen } = useAuth();
  const location = useLocation();
  const titel = paginaTitels[location.pathname] || 'PA Atelier';

  return (
    <header className="relative bg-white border-b border-cream-200 px-8 py-4 flex items-center justify-between gap-4 shadow-editorial">
      <h2 className="font-serif text-xl text-antraciet-800 flex-shrink-0">{titel}</h2>

      <div className="flex items-center gap-4">
        <InfluencerSwitch />
        <NotificatieCentrum />
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
