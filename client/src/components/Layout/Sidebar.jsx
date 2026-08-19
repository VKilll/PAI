import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package, CreditCard, Plane, Calendar, FileText, Receipt, Handshake,
  TrendingUp, BarChart2, MessageSquare, LayoutDashboard, Mail
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// rollen: leeg = zichtbaar voor iedereen
const navigatie = [
  { naar: '/',                 label: 'Dashboard',      icoon: LayoutDashboard },
  { naar: '/samenwerkingen',   label: 'Samenwerkingen', icoon: Handshake },
  { naar: '/pakketten',        label: 'Pakketten',      icoon: Package },
  { naar: '/verkoopfacturen',  label: 'Verkoopfacturen',icoon: Receipt,     rollen: ['manager'] },
  { naar: '/mijn-facturen',    label: 'Mijn facturen',  icoon: Receipt,     rollen: ['influencer', 'pa'] },
  { naar: '/financien',        label: 'Financiën',      icoon: CreditCard,  rollen: ['pa', 'manager', 'staff', 'influencer'] },
  { naar: '/berichten',        label: 'Berichten',      icoon: Mail,        rollen: ['influencer'] },
  { naar: '/reizen',           label: 'Reizen',         icoon: Plane },
  { naar: '/content',          label: 'Content',        icoon: Calendar },
  { naar: '/briefings',        label: 'Briefings',      icoon: FileText },
  { naar: '/research',         label: 'Research',       icoon: TrendingUp },
  { naar: '/statistieken',     label: 'Statistieken',   icoon: BarChart2 },
  { naar: '/engagement',       label: 'Engagement',     icoon: MessageSquare },
];

export default function Sidebar() {
  const { gebruiker } = useAuth();
  const zichtbaar = navigatie.filter(item => !item.rollen || item.rollen.includes(gebruiker?.rol));

  return (
    <aside className="w-56 bg-antraciet-800 flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <h1 className="font-serif text-xl text-cream-50 tracking-tight">PA Atelier</h1>
        <p className="font-sans text-[10px] text-goud-400 tracking-widest uppercase mt-0.5">
          {gebruiker?.rol === 'manager' ? 'Management' : gebruiker?.rol === 'influencer' ? 'Portaal' : 'Management'}
        </p>
      </div>

      {/* Navigatie */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {zichtbaar.map(({ naar, label, icoon: Icoon }) => (
          <NavLink
            key={naar}
            to={naar}
            end={naar === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-editorial text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-white/10 text-cream-50 font-medium'
                  : 'text-white/60 hover:text-cream-50 hover:bg-white/5'
              }`
            }
          >
            <Icoon size={16} strokeWidth={1.5} />
            <span className="font-sans">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Goud accent lijn onderaan */}
      <div className="h-1 bg-gradient-to-r from-goud-500 to-goud-300" />
    </aside>
  );
}
