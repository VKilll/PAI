import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Package, CreditCard, Plane, Calendar, FileText, Receipt, Handshake, Users,
  TrendingUp, BarChart2, MessageSquare, Sun, Mail, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// De modules die over één influencer gaan. Bij de PA en de manager zitten ze
// samen onder "Influencers"; een influencer ziet ze gewoon los in het menu,
// want daar gaat alles per definitie over zichzelf.
const influencerModules = [
  { naar: '/content',    label: 'Content',   icoon: Calendar },
  { naar: '/financien',  label: 'Financiën', icoon: CreditCard },
  { naar: '/pakketten',  label: 'Pakketten', icoon: Package },
  { naar: '/reizen',     label: 'Reizen',    icoon: Plane },
];

// rollen leeg = zichtbaar voor iedereen
const overigeModules = [
  { naar: '/samenwerkingen',  label: 'Samenwerkingen',  icoon: Handshake },
  { naar: '/briefings',       label: 'Briefings',       icoon: FileText },
  { naar: '/verkoopfacturen', label: 'Verkoopfacturen', icoon: Receipt,        rollen: ['manager'] },
  { naar: '/mijn-facturen',   label: 'Mijn facturen',   icoon: Receipt,        rollen: ['influencer', 'pa'] },
  { naar: '/berichten',       label: 'Berichten',       icoon: Mail,           rollen: ['influencer'] },
  { naar: '/research',        label: 'Research',        icoon: TrendingUp },
  { naar: '/statistieken',    label: 'Statistieken',    icoon: BarChart2 },
  { naar: '/engagement',      label: 'Engagement',      icoon: MessageSquare },
];

const linkKlassen = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-editorial text-sm transition-colors duration-150 ${
    isActive ? 'bg-white/10 text-cream-50 font-medium' : 'text-white/60 hover:text-cream-50 hover:bg-white/5'
  }`;

function Item({ naar, label, icoon: Icoon, klein = false }) {
  return (
    <NavLink to={naar} end={naar === '/'} className={linkKlassen}>
      <Icoon size={klein ? 14 : 16} strokeWidth={1.5} />
      <span className={`font-sans ${klein ? 'text-[13px]' : ''}`}>{label}</span>
    </NavLink>
  );
}

// ── Influencers met uitklapbare submodules ────────────────────
function InfluencersGroep() {
  const location = useLocation();
  const binnenGroep = ['/influencers', ...influencerModules.map(m => m.naar)]
    .some(pad => location.pathname.startsWith(pad));
  const [open, setOpen] = useState(binnenGroep);

  return (
    <div>
      <div className="flex items-center">
        <NavLink to="/influencers" className={`${linkKlassen({ isActive: location.pathname === '/influencers' })} flex-1`}>
          <Users size={16} strokeWidth={1.5} />
          <span className="font-sans">Influencers</span>
        </NavLink>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-2 text-white/40 hover:text-cream-50 transition-colors"
          title={open ? 'Inklappen' : 'Uitklappen'}
          aria-expanded={open}
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {open && (
        <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5 mt-0.5">
          {influencerModules.map(m => <Item key={m.naar} {...m} klein />)}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { gebruiker, magWisselen } = useAuth();
  const zichtbaar = overigeModules.filter(m => !m.rollen || m.rollen.includes(gebruiker?.rol));

  return (
    <aside className="w-56 bg-antraciet-800 flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <h1 className="font-serif text-xl text-cream-50 tracking-tight">PA Atelier</h1>
        <p className="font-sans text-[10px] text-goud-400 tracking-widest uppercase mt-0.5">
          {gebruiker?.rol === 'influencer' ? 'Portaal' : 'Management'}
        </p>
      </div>

      {/* Navigatie */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <Item naar="/" label="Vandaag" icoon={Sun} />

        {magWisselen
          ? <InfluencersGroep />
          : influencerModules.map(m => <Item key={m.naar} {...m} />)}

        <div className="h-px bg-white/10 my-2 mx-3" />

        {zichtbaar.map(m => <Item key={m.naar} {...m} />)}
      </nav>

      {/* Goud accent lijn onderaan */}
      <div className="h-1 bg-gradient-to-r from-goud-500 to-goud-300" />
    </aside>
  );
}
