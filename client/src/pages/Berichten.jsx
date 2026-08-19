import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Mail, MailOpen, RefreshCw, Receipt } from 'lucide-react';
import api from '../utils/api';

function datum(waarde) {
  if (!waarde) return '';
  try { return format(parseISO(waarde.replace(' ', 'T')), 'd MMMM yyyy HH:mm', { locale: nl }); }
  catch { return waarde; }
}

export default function Berichten() {
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const r = await api.get('/portal-messages');
      setItems(r.data);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { laadData(); }, [laadData]);

  async function markeerGelezen(bericht) {
    if (bericht.gelezen) return;
    await api.patch(`/portal-messages/${bericht.id}/gelezen`).catch(() => {});
    laadData();
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Berichten</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Berichten vanuit het management</p>
        </div>
        <button
          onClick={laadData}
          className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
          title="Vernieuwen"
        >
          <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
        </button>
      </div>

      {laden ? (
        <div className="flex items-center justify-center py-16 text-gray-300">
          <RefreshCw size={20} className="animate-spin mr-2" />
          <span className="font-sans text-sm">Laden...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-300">
          <Mail size={40} strokeWidth={1} className="mb-3" />
          <p className="font-serif text-lg">Geen berichten</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(b => (
            <div
              key={b.id}
              onClick={() => markeerGelezen(b)}
              className={`card cursor-pointer transition-shadow hover:shadow-card ${
                b.gelezen ? '' : 'border-l-2 border-goud-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-cream-200 text-goud-600 flex items-center justify-center flex-shrink-0">
                  {b.gelezen ? <MailOpen size={16} /> : <Mail size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-sans text-sm font-medium text-antraciet-800">{b.onderwerp}</p>
                    <p className="font-sans text-xs text-gray-400 flex-shrink-0">{datum(b.aangemaakt)}</p>
                  </div>
                  <p className="font-sans text-sm text-gray-500 mt-1.5 whitespace-pre-line leading-relaxed">
                    {b.bericht}
                  </p>
                  {b.afzender_naam && (
                    <p className="font-sans text-xs text-gray-400 mt-2">van {b.afzender_naam}</p>
                  )}
                  {b.type === 'factuur_verzoek' && (
                    <Link
                      to={`/mijn-facturen${b.collaboration_id ? `?samenwerking=${b.collaboration_id}` : ''}`}
                      className="btn-primair inline-flex items-center gap-2 mt-4 text-sm"
                      onClick={e => e.stopPropagation()}
                    >
                      <Receipt size={15} />
                      Factuur opstellen
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
