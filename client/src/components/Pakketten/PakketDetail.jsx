import React, { useState } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Package, ArrowRight, Sparkles, Trash2, Plus,
  AlertTriangle, Clock, ChevronRight
} from 'lucide-react';
import api from '../../utils/api';
import StatusBadge, { statusConfig } from '../UI/StatusBadge';
import { useAuth } from '../../context/AuthContext';

const statusVolgorde = [
  'verwacht', 'ontvangen', 'geopend', 'verwerkt',
  'retour_aangemeld', 'geretourneerd', 'afgerond'
];

function RetourDeadlineIndicator({ deadline }) {
  if (!deadline) return null;
  const dagen = differenceInDays(parseISO(deadline), new Date());
  const kleur = dagen < 0 ? 'text-red-600 bg-red-50 border-red-200'
    : dagen <= 3 ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-green-700 bg-green-50 border-green-200';

  return (
    <div className={`flex items-center gap-2 text-xs font-sans px-3 py-2 rounded-editorial border ${kleur}`}>
      {dagen < 0 ? <AlertTriangle size={14} /> : <Clock size={14} />}
      {dagen < 0
        ? `Retourdeadline ${Math.abs(dagen)} dagen geleden verstreken`
        : dagen === 0
        ? 'Retourdeadline is vandaag!'
        : `Retour uiterlijk ${format(parseISO(deadline), 'd MMMM yyyy', { locale: nl })} (nog ${dagen} dag${dagen === 1 ? '' : 'en'})`
      }
    </div>
  );
}

function ItemsLijst({ items, pakketId, onVernieuwd, isPA }) {
  const [nieuwItem, setNieuwItem] = useState(false);
  const [itemForm, setItemForm] = useState({ naam: '', categorie: '', merk: '', maat: '', kleur: '', waarde: '' });
  const [laden, setLaden] = useState(false);

  const categorieën = ['Kleding', 'Schoenen', 'Accessoires', 'Beauty', 'Tas', 'Sieraden', 'Anders'];

  async function voegToe() {
    if (!itemForm.naam.trim()) return;
    setLaden(true);
    try {
      await api.post(`/packages/${pakketId}/items`, itemForm);
      setItemForm({ naam: '', categorie: '', merk: '', maat: '', kleur: '', waarde: '' });
      setNieuwItem(false);
      onVernieuwd();
    } finally {
      setLaden(false);
    }
  }

  async function verwijder(itemId) {
    await api.delete(`/packages/${pakketId}/items/${itemId}`);
    onVernieuwd();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-base text-antraciet-800">Items ({items.length})</h3>
        {isPA && (
          <button
            onClick={() => setNieuwItem(v => !v)}
            className="flex items-center gap-1 text-xs text-goud-600 hover:text-goud-500 font-sans font-medium"
          >
            <Plus size={14} />
            Item toevoegen
          </button>
        )}
      </div>

      {items.length === 0 && !nieuwItem && (
        <p className="text-xs text-gray-400 font-sans italic py-2">Nog geen items toegevoegd.</p>
      )}

      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className="flex items-start justify-between bg-cream-50 rounded-editorial px-3 py-2.5">
            <div>
              <p className="font-sans text-sm font-medium text-antraciet-800">{item.naam}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">
                {[item.categorie, item.merk, item.maat, item.kleur].filter(Boolean).join(' · ')}
                {item.waarde ? ` · €${Number(item.waarde).toFixed(2)}` : ''}
              </p>
            </div>
            {isPA && (
              <button
                onClick={() => verwijder(item.id)}
                className="text-gray-300 hover:text-red-400 transition-colors ml-2 mt-0.5"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Nieuw item formulier */}
      {nieuwItem && (
        <div className="mt-3 bg-cream-50 rounded-editorial p-3 space-y-2 border border-cream-200">
          <input
            className="input text-sm"
            placeholder="Naam item *"
            value={itemForm.naam}
            onChange={e => setItemForm(v => ({ ...v, naam: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input text-sm"
              value={itemForm.categorie}
              onChange={e => setItemForm(v => ({ ...v, categorie: e.target.value }))}
            >
              <option value="">Categorie</option>
              {categorieën.map(c => <option key={c}>{c}</option>)}
            </select>
            <input
              className="input text-sm"
              placeholder="Maat (bijv. S/36)"
              value={itemForm.maat}
              onChange={e => setItemForm(v => ({ ...v, maat: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input text-sm"
              placeholder="Kleur"
              value={itemForm.kleur}
              onChange={e => setItemForm(v => ({ ...v, kleur: e.target.value }))}
            />
            <input
              type="number"
              className="input text-sm"
              placeholder="Waarde (€)"
              value={itemForm.waarde}
              onChange={e => setItemForm(v => ({ ...v, waarde: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={voegToe} disabled={laden} className="btn-primair text-xs py-1.5 px-3 disabled:opacity-50">
              {laden ? '...' : 'Toevoegen'}
            </button>
            <button onClick={() => setNieuwItem(false)} className="btn-secundair text-xs py-1.5 px-3">
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PakketDetail({ pakket, onVernieuwd, onSluit }) {
  const { isPA, isStaff } = useAuth();
  const [statusLaden, setStatusLaden] = useState(false);
  const [aiLaden, setAiLaden] = useState(false);
  const [retourBeleid, setRetourBeleid] = useState(pakket.retour_beleid || null);
  const [statusNotitie, setStatusNotitie] = useState('');

  const huidigIndex = statusVolgorde.indexOf(pakket.status);
  const volgendeStatus = statusVolgorde[huidigIndex + 1];

  async function wijzigStatus(nieuweStatus) {
    setStatusLaden(true);
    try {
      await api.patch(`/packages/${pakket.id}/status`, {
        status: nieuweStatus,
        notitie: statusNotitie || undefined,
      });
      setStatusNotitie('');
      onVernieuwd();
    } finally {
      setStatusLaden(false);
    }
  }

  async function haalRetourBeleid() {
    setAiLaden(true);
    try {
      const r = await api.post(`/packages/${pakket.id}/retour-beleid`);
      setRetourBeleid(r.data.retour_beleid);
      onVernieuwd();
    } catch (err) {
      alert(err.response?.data?.error || 'Kon retourbeleid niet ophalen');
    } finally {
      setAiLaden(false);
    }
  }

  const formatDatum = (d) => d ? format(parseISO(d), 'd MMMM yyyy', { locale: nl }) : '—';

  return (
    <div className="divide-y divide-cream-200">

      {/* ── Koptekst ── */}
      <div className="px-6 py-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-2xl text-antraciet-800">{pakket.merk}</h3>
            <p className="font-sans text-sm text-gray-400 mt-0.5">{pakket.influencer_naam}</p>
          </div>
          <StatusBadge status={pakket.status} />
        </div>

        {pakket.omschrijving && (
          <p className="font-sans text-sm text-antraciet-700">{pakket.omschrijving}</p>
        )}

        {/* Retour deadline indicator */}
        {pakket.retour_vereist && pakket.retour_deadline && (
          <RetourDeadlineIndicator deadline={pakket.retour_deadline} />
        )}
      </div>

      {/* ── Status werkbalk ── */}
      {(isPA || isStaff) && volgendeStatus && pakket.status !== 'afgerond' && (
        <div className="px-6 py-4 bg-cream-50 space-y-3">
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider">Volgende stap</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={pakket.status} />
            <ArrowRight size={14} className="text-gray-300" />
            <StatusBadge status={volgendeStatus} />
          </div>
          <input
            className="input text-sm"
            placeholder="Optionele notitie bij statuswijziging..."
            value={statusNotitie}
            onChange={e => setStatusNotitie(e.target.value)}
          />
          <button
            onClick={() => wijzigStatus(volgendeStatus)}
            disabled={statusLaden}
            className="btn-primair w-full text-sm disabled:opacity-50"
          >
            {statusLaden ? 'Bezig...' : `Markeren als: ${statusConfig[volgendeStatus]?.label}`}
          </button>
        </div>
      )}

      {/* ── Details ── */}
      <div className="px-6 py-5 space-y-3">
        <h3 className="font-serif text-base text-antraciet-800">Details</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-sans text-sm">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Trackingnummer</dt>
            <dd className="text-antraciet-800 font-medium">{pakket.tracking_nummer || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Vervoerder</dt>
            <dd className="text-antraciet-800">{pakket.vervoerder || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Verwacht</dt>
            <dd className="text-antraciet-800">{formatDatum(pakket.verwachte_datum)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Ontvangen</dt>
            <dd className="text-antraciet-800">{formatDatum(pakket.ontvangen_datum)}</dd>
          </div>
          {pakket.retour_vereist ? (
            <>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Retour vereist</dt>
                <dd className="text-antraciet-800">Ja</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Retourdeadline</dt>
                <dd className="text-antraciet-800 font-medium">{formatDatum(pakket.retour_deadline)}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Retour vereist</dt>
              <dd className="text-antraciet-800">Nee</dd>
            </div>
          )}
        </dl>

        {pakket.notities && (
          <div className="mt-2 bg-cream-50 rounded-editorial px-3 py-2.5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notities</p>
            <p className="font-sans text-sm text-antraciet-700">{pakket.notities}</p>
          </div>
        )}
      </div>

      {/* ── Items ── */}
      <div className="px-6 py-5">
        <ItemsLijst
          items={pakket.items || []}
          pakketId={pakket.id}
          onVernieuwd={onVernieuwd}
          isPA={isPA || isStaff}
        />
      </div>

      {/* ── AI Retourbeleid ── */}
      {pakket.retour_vereist && (
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base text-antraciet-800">Retourbeleid</h3>
            {(isPA || isStaff) && (
              <button
                onClick={haalRetourBeleid}
                disabled={aiLaden}
                className="flex items-center gap-1.5 text-xs font-sans font-medium text-goud-600 hover:text-goud-500 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {aiLaden ? 'Ophalen...' : retourBeleid ? 'Verversen' : 'AI ophalen'}
              </button>
            )}
          </div>

          {retourBeleid ? (
            <div className="bg-cream-50 rounded-editorial px-4 py-3 text-sm font-sans text-antraciet-700 whitespace-pre-line leading-relaxed">
              {retourBeleid}
              {pakket.retour_beleid_bron && (
                <p className="text-xs text-gray-400 mt-2 border-t border-cream-200 pt-2">
                  Bron: {pakket.retour_beleid_bron}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-sans text-gray-400 italic">
              Klik op "AI ophalen" om het retourbeleid automatisch op te halen.
            </p>
          )}
        </div>
      )}

      {/* ── Statusgeschiedenis ── */}
      {pakket.geschiedenis && pakket.geschiedenis.length > 0 && (
        <div className="px-6 py-5">
          <h3 className="font-serif text-base text-antraciet-800 mb-3">Geschiedenis</h3>
          <ol className="space-y-2">
            {pakket.geschiedenis.map(h => (
              <li key={h.id} className="flex items-start gap-3 text-xs font-sans">
                <div className="w-1.5 h-1.5 rounded-full bg-goud-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-antraciet-700 font-medium">
                    {statusConfig[h.naar_status]?.label || h.naar_status}
                  </span>
                  {h.notitie && <span className="text-gray-400"> — {h.notitie}</span>}
                  <p className="text-gray-400 mt-0.5">
                    {format(new Date(h.aangemaakt), 'd MMM yyyy HH:mm', { locale: nl })}
                    {h.gewijzigd_door_naam ? ` · ${h.gewijzigd_door_naam}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
