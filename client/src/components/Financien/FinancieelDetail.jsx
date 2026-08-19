import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CheckCircle, Circle, FileText, ExternalLink, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const typeLabels = {
  inkoopfactuur:    'Inkoopfactuur',
  bon:              'Bon',
  betaling:         'Betaling',
  salarisoverzicht: 'Salarisoverzicht',
};

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag);
}

export default function FinancieelDetail({ item, onVernieuwd, onVerwijder }) {
  const { isPA, isStaff } = useAuth();
  const [betaaldLaden, setBetaaldLaden] = useState(false);
  const [uploadLaden, setUploadLaden]   = useState(false);

  async function toggleBetaald() {
    setBetaaldLaden(true);
    try {
      await api.patch(`/finance/${item.id}/betaald`, { betaald: !item.betaald });
      onVernieuwd();
    } finally {
      setBetaaldLaden(false);
    }
  }

  async function uploadBestand(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadLaden(true);
    const fd = new FormData();
    fd.append('bestand', file);
    try {
      await api.post(`/finance/${item.id}/bestand`, fd);
      onVernieuwd();
    } finally {
      setUploadLaden(false);
    }
  }

  const isPDF = item.bestand_url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="divide-y divide-cream-200">

      {/* ── Koptekst ── */}
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-1">
              {typeLabels[item.type] || item.type}
            </p>
            <h3 className="font-serif text-2xl text-antraciet-800">{item.omschrijving}</h3>
            {item.opdrachtgever && (
              <p className="font-sans text-sm text-gray-400 mt-0.5">{item.opdrachtgever}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`font-serif text-2xl font-medium ${item.categorie_type === 'inkomsten' ? 'text-green-700' : 'text-antraciet-800'}`}>
              {item.categorie_type === 'inkomsten' ? '+' : '-'}{formaatBedrag(item.bedrag, item.valuta)}
            </p>
            {item.btw_bedrag > 0 && (
              <p className="font-sans text-xs text-gray-400 mt-0.5">incl. {formaatBedrag(item.btw_bedrag)} BTW</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Betaalstatus ── */}
      {(isPA || isStaff) && (
        <div className="px-6 py-4">
          <button
            onClick={toggleBetaald}
            disabled={betaaldLaden}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-editorial border transition-colors ${
              item.betaald
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                : 'bg-cream-50 border-cream-300 text-antraciet-700 hover:bg-cream-100'
            }`}
          >
            {item.betaald
              ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              : <Circle size={18} className="text-gray-300 flex-shrink-0" />
            }
            <div className="text-left">
              <p className="font-sans text-sm font-medium">
                {item.betaald ? 'Betaald / ontvangen' : 'Nog niet betaald'}
              </p>
              {item.betaald && item.betaald_datum && (
                <p className="font-sans text-xs text-green-600 mt-0.5">
                  op {format(parseISO(item.betaald_datum), 'd MMMM yyyy', { locale: nl })}
                </p>
              )}
            </div>
            {!item.betaald && (
              <span className="ml-auto font-sans text-xs text-gray-400">Klik om te markeren</span>
            )}
          </button>
        </div>
      )}

      {/* ── Details ── */}
      <div className="px-6 py-5 space-y-3">
        <h3 className="font-serif text-base text-antraciet-800">Details</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-sans text-sm">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Datum</dt>
            <dd className="text-antraciet-800">{format(parseISO(item.datum), 'd MMMM yyyy', { locale: nl })}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Influencer</dt>
            <dd className="text-antraciet-800">{item.influencer_naam}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Categorie</dt>
            <dd className="text-antraciet-800">{item.categorie_naam || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Valuta</dt>
            <dd className="text-antraciet-800">{item.valuta}</dd>
          </div>
        </dl>
        {item.notities && (
          <div className="mt-2 bg-cream-50 rounded-editorial px-3 py-2.5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notities</p>
            <p className="font-sans text-sm text-antraciet-700">{item.notities}</p>
          </div>
        )}
      </div>

      {/* ── Bijlage ── */}
      <div className="px-6 py-5 space-y-3">
        <h3 className="font-serif text-base text-antraciet-800">Bijlage</h3>
        {item.bestand_url ? (
          <div className="flex items-center justify-between bg-cream-50 rounded-editorial px-4 py-3 border border-cream-200">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-goud-500" />
              <span className="font-sans text-sm text-antraciet-700">
                {isPDF ? 'PDF document' : 'Afbeelding'}
              </span>
            </div>
            <a
              href={item.bestand_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-goud-600 hover:text-goud-500 font-sans font-medium"
            >
              <ExternalLink size={13} />
              Openen
            </a>
          </div>
        ) : (
          <p className="text-sm font-sans text-gray-400 italic">Geen bijlage</p>
        )}

        {(isPA || isStaff) && (
          <label className="cursor-pointer">
            <span className="btn-secundair text-xs py-1.5 px-3 inline-block">
              {uploadLaden ? 'Uploaden...' : item.bestand_url ? 'Bijlage vervangen' : 'Bijlage uploaden'}
            </span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={uploadBestand} />
          </label>
        )}
      </div>

      {/* ── Verwijderen ── */}
      {isPA && (
        <div className="px-6 py-5">
          <button
            onClick={() => onVerwijder(item.id)}
            className="flex items-center gap-2 text-xs text-red-400 hover:text-red-600 font-sans transition-colors"
          >
            <Trash2 size={14} />
            Item verwijderen
          </button>
        </div>
      )}
    </div>
  );
}
