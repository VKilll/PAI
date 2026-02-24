import React from 'react';

const statusConfig = {
  verwacht:         { label: 'Verwacht',          kleur: 'bg-cream-200 text-antraciet-700 border border-cream-300' },
  ontvangen:        { label: 'Ontvangen',          kleur: 'bg-blue-50 text-blue-700 border border-blue-100' },
  geopend:          { label: 'Geopend',            kleur: 'bg-purple-50 text-purple-700 border border-purple-100' },
  verwerkt:         { label: 'Verwerkt',           kleur: 'bg-amber-50 text-amber-700 border border-amber-100' },
  retour_aangemeld: { label: 'Retour aangemeld',   kleur: 'bg-orange-50 text-orange-700 border border-orange-100' },
  geretourneerd:    { label: 'Geretourneerd',      kleur: 'bg-green-50 text-green-700 border border-green-100' },
  afgerond:         { label: 'Afgerond',           kleur: 'bg-gray-50 text-gray-500 border border-gray-200' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, kleur: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`badge ${config.kleur} font-sans`}>
      {config.label}
    </span>
  );
}

export { statusConfig };
