import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Package, CreditCard, Plane, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';

const modules = [
  { naar: '/samenwerkingen', label: 'Samenwerkingen', icoon: Handshake,  kleur: 'bg-green-50 text-green-500' },
  { naar: '/pakketten',      label: 'Pakketten',      icoon: Package,    kleur: 'bg-roos-100 text-roos-400'  },
  { naar: '/financien',      label: 'Financiën',      icoon: CreditCard, kleur: 'bg-cream-200 text-goud-600' },
  { naar: '/reizen',         label: 'Reizen',         icoon: Plane,      kleur: 'bg-blue-50 text-blue-400'   },
];

export default function Dashboard() {
  const { gebruiker } = useAuth();
  const uur = new Date().getHours();
  const groet = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';

  return (
    <div className="p-8 max-w-5xl">
      {/* Begroeting */}
      <div className="mb-10">
        <h1 className="font-serif text-display text-antraciet-800">
          {groet}, {gebruiker?.naam?.split(' ')[0]}.
        </h1>
        <p className="font-sans text-gray-400 mt-2">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Snelle toegang */}
      <div className="mb-8">
        <h2 className="font-serif text-lg text-antraciet-700 mb-4">Snelle toegang</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {modules.map(({ naar, label, icoon: Icoon, kleur }) => (
            <Link key={naar} to={naar} className="card hover:shadow-card transition-shadow duration-200 group">
              <div className={`w-10 h-10 rounded-full ${kleur} flex items-center justify-center mb-3`}>
                <Icoon size={18} />
              </div>
              <p className="font-sans text-sm font-medium text-antraciet-800 group-hover:text-goud-600 transition-colors">
                {label}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Status bericht */}
      <div className="card border-l-2 border-goud-400">
        <p className="font-sans text-sm text-gray-500">
          Welkom bij <span className="font-medium text-antraciet-800">PA Atelier</span>.
          Samenwerkingen lopen van aanvraag naar archief; zodra er gepost is, zet het systeem de
          verkoopfactuur voor de manager klaar.
        </p>
      </div>
    </div>
  );
}
