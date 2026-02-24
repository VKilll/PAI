import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Plus, Search, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { statusConfig } from '../components/UI/StatusBadge';
import SlideOver from '../components/UI/SlideOver';
import Modal from '../components/UI/Modal';
import PakketFormulier from '../components/Pakketten/PakketFormulier';
import PakketDetail from '../components/Pakketten/PakketDetail';

const ALLE_STATUSSEN = ['verwacht','ontvangen','geopend','verwerkt','retour_aangemeld','geretourneerd','afgerond'];

// ── Statusfilter balk bovenaan ─────────────────────────────
function StatusFilterBalk({ actief, onWijzig, tellingen }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onWijzig('')}
        className={`px-3 py-1.5 text-xs font-sans font-medium rounded-full border transition-colors ${
          actief === '' ? 'bg-antraciet-800 text-cream-50 border-antraciet-800' : 'bg-white text-antraciet-700 border-cream-300 hover:border-antraciet-400'
        }`}
      >
        Alle {tellingen.totaal ? `(${tellingen.totaal})` : ''}
      </button>
      {ALLE_STATUSSEN.map(s => {
        const conf = statusConfig[s];
        const aantal = tellingen[s] || 0;
        if (aantal === 0 && actief !== s) return null;
        return (
          <button
            key={s}
            onClick={() => onWijzig(s === actief ? '' : s)}
            className={`px-3 py-1.5 text-xs font-sans font-medium rounded-full border transition-colors ${
              actief === s ? 'bg-antraciet-800 text-cream-50 border-antraciet-800' : 'bg-white text-antraciet-700 border-cream-300 hover:border-antraciet-400'
            }`}
          >
            {conf?.label} {aantal > 0 ? `(${aantal})` : ''}
          </button>
        );
      })}
    </div>
  );
}

// ── Retour waarschuwing ────────────────────────────────────
function RetourWaarschuwing({ pakketten }) {
  const urgent = pakketten.filter(p =>
    p.retour_vereist && p.retour_deadline &&
    !['geretourneerd','afgerond'].includes(p.status) &&
    differenceInDays(parseISO(p.retour_deadline), new Date()) <= 3
  );
  if (urgent.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-editorial px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-sans text-sm font-medium text-orange-800">
          {urgent.length} pakket{urgent.length > 1 ? 'ten' : ''} met urgente retourdeadline
        </p>
        <ul className="mt-1 space-y-0.5">
          {urgent.map(p => {
            const dagen = differenceInDays(parseISO(p.retour_deadline), new Date());
            return (
              <li key={p.id} className="font-sans text-xs text-orange-700">
                {p.merk} ({p.influencer_naam}) —{' '}
                {dagen < 0 ? `${Math.abs(dagen)} dag${Math.abs(dagen) !== 1 ? 'en' : ''} te laat` :
                 dagen === 0 ? 'vandaag!' : `nog ${dagen} dag${dagen !== 1 ? 'en' : ''}`}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── Pakket rij ────────────────────────────────────────────
function PakketRij({ pakket, onClick }) {
  const retourUrgent = pakket.retour_vereist && pakket.retour_deadline &&
    !['geretourneerd','afgerond'].includes(pakket.status) &&
    differenceInDays(parseISO(pakket.retour_deadline), new Date()) <= 3;

  return (
    <tr
      onClick={() => onClick(pakket)}
      className="border-b border-cream-200 hover:bg-cream-50 cursor-pointer transition-colors group"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {retourUrgent && <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />}
          <div>
            <p className="font-sans text-sm font-medium text-antraciet-800 group-hover:text-goud-600 transition-colors">
              {pakket.merk}
            </p>
            {pakket.omschrijving && (
              <p className="font-sans text-xs text-gray-400 mt-0.5 truncate max-w-xs">{pakket.omschrijving}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-sans text-sm text-antraciet-700">{pakket.influencer_naam}</p>
        <p className="font-sans text-xs text-gray-400">{pakket.influencer_handle}</p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={pakket.status} />
      </td>
      <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
        {pakket.tracking_nummer || <span className="text-gray-300">—</span>}
        {pakket.vervoerder && <span className="text-gray-400 text-xs ml-1">({pakket.vervoerder})</span>}
      </td>
      <td className="px-4 py-4 font-sans text-sm">
        {pakket.retour_vereist && pakket.retour_deadline ? (
          <span className={
            differenceInDays(parseISO(pakket.retour_deadline), new Date()) < 0 ? 'text-red-600 font-medium' :
            differenceInDays(parseISO(pakket.retour_deadline), new Date()) <= 3 ? 'text-orange-600 font-medium' :
            'text-antraciet-700'
          }>
            {format(parseISO(pakket.retour_deadline), 'd MMM', { locale: nl })}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-4 font-sans text-sm text-antraciet-700 text-center">
        {pakket.aantal_items > 0 ? (
          <span className="bg-cream-200 text-antraciet-700 text-xs px-2 py-0.5 rounded-full">{pakket.aantal_items}</span>
        ) : (
          <span className="text-gray-300">0</span>
        )}
      </td>
      <td className="px-4 py-4 font-sans text-xs text-gray-400">
        {pakket.aangemaakt ? format(new Date(pakket.aangemaakt), 'd MMM yyyy', { locale: nl }) : '—'}
      </td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════════
// Hoofdpagina
// ════════════════════════════════════════════════════════════
export default function Pakketten() {
  const { isPA, isStaff } = useAuth();
  const [pakketten, setPakketten]         = useState([]);
  const [laden, setLaden]                 = useState(true);
  const [fout, setFout]                   = useState('');
  const [zoekterm, setZoekterm]           = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [geselecteerd, setGeselecteerd]   = useState(null);
  const [detailOpen, setDetailOpen]       = useState(false);
  const [nieuwOpen, setNieuwOpen]         = useState(false);
  const [detailData, setDetailData]       = useState(null);
  const [detailLaden, setDetailLaden]     = useState(false);

  const laadPakketten = useCallback(async () => {
    setLaden(true);
    setFout('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (zoekterm)     params.zoek   = zoekterm;
      const r = await api.get('/packages', { params });
      setPakketten(r.data);
    } catch {
      setFout('Kon pakketten niet laden. Controleer de serververbinding.');
    } finally {
      setLaden(false);
    }
  }, [statusFilter, zoekterm]);

  useEffect(() => {
    const timer = setTimeout(laadPakketten, 300);
    return () => clearTimeout(timer);
  }, [laadPakketten]);

  async function openDetail(pakket) {
    setGeselecteerd(pakket);
    setDetailOpen(true);
    setDetailLaden(true);
    try {
      const r = await api.get(`/packages/${pakket.id}`);
      setDetailData(r.data);
    } finally {
      setDetailLaden(false);
    }
  }

  async function vernieuwtDetail() {
    if (!geselecteerd) return;
    const r = await api.get(`/packages/${geselecteerd.id}`);
    setDetailData(r.data);
    laadPakketten();
  }

  async function maakNieuwPakket(form) {
    await api.post('/packages', form);
    setNieuwOpen(false);
    laadPakketten();
  }

  // Tellingen per status
  const tellingen = pakketten.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    acc.totaal = (acc.totaal || 0) + 1;
    return acc;
  }, {});

  // Alle pakketten voor retourwaarschuwing (zonder statusfilter)
  const [allePakketten, setAllePakketten] = useState([]);
  useEffect(() => {
    api.get('/packages').then(r => setAllePakketten(r.data)).catch(() => {});
  }, [laden]);

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Koptekst ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Pakketten</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Beheer alle binnenkomende en te retourneren pakketten
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={laadPakketten}
            className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
          </button>
          {(isPA || isStaff) && (
            <button onClick={() => setNieuwOpen(true)} className="btn-primair flex items-center gap-2">
              <Plus size={16} />
              Nieuw pakket
            </button>
          )}
        </div>
      </div>

      {/* ── Retour waarschuwingen ── */}
      <RetourWaarschuwing pakketten={allePakketten} />

      {/* ── Zoeken + statusfilter ── */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Zoek op merk, omschrijving of tracking..."
            value={zoekterm}
            onChange={e => setZoekterm(e.target.value)}
          />
        </div>
        <StatusFilterBalk actief={statusFilter} onWijzig={setStatusFilter} tellingen={tellingen} />
      </div>

      {/* ── Foutmelding ── */}
      {fout && (
        <div className="bg-red-50 border border-red-100 rounded-editorial px-4 py-3 text-sm text-red-700 font-sans">
          {fout}
        </div>
      )}

      {/* ── Tabel ── */}
      <div className="card p-0 overflow-hidden">
        {laden ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="font-sans text-sm">Laden...</span>
          </div>
        ) : pakketten.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <Package size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">Geen pakketten gevonden</p>
            <p className="font-sans text-sm mt-1">
              {zoekterm || statusFilter ? 'Probeer andere filters' : 'Klik op "Nieuw pakket" om te beginnen'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Merk / Omschrijving</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Tracking</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Retour</th>
                  <th className="px-4 py-3 text-center font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Aangemaakt</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {pakketten.map(p => (
                  <PakketRij key={p.id} pakket={p} onClick={openDetail} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail slide-over ── */}
      <SlideOver
        open={detailOpen}
        onSluit={() => { setDetailOpen(false); setDetailData(null); setGeselecteerd(null); }}
        titel={geselecteerd ? `${geselecteerd.merk}` : 'Pakket detail'}
      >
        {detailLaden ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <RefreshCw size={18} className="animate-spin mr-2" />
            <span className="font-sans text-sm">Laden...</span>
          </div>
        ) : detailData ? (
          <PakketDetail
            pakket={detailData}
            onVernieuwd={vernieuwtDetail}
            onSluit={() => setDetailOpen(false)}
          />
        ) : null}
      </SlideOver>

      {/* ── Nieuw pakket modal ── */}
      <Modal open={nieuwOpen} onSluit={() => setNieuwOpen(false)} titel="Nieuw pakket toevoegen">
        <PakketFormulier
          onOpslaan={maakNieuwPakket}
          onAnnuleer={() => setNieuwOpen(false)}
        />
      </Modal>
    </div>
  );
}
