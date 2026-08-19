import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Plus, Search, RefreshCw, Download, TrendingUp,
  TrendingDown, Minus, CheckCircle, Circle, FileText
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import SlideOver from '../components/UI/SlideOver';
import Modal from '../components/UI/Modal';
import FinancieelFormulier from '../components/Financien/FinancieelFormulier';
import FinancieelDetail from '../components/Financien/FinancieelDetail';

// ── Helpers ───────────────────────────────────────────────
function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

const typeLabels = { inkoopfactuur: 'Inkoopfactuur', bon: 'Bon', betaling: 'Betaling', salarisoverzicht: 'Salaris' };

// ── Samenvattingskaart ────────────────────────────────────
function SamenvattingsKaart({ titel, bedrag, icoon: Icoon, kleur, sub }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${kleur}`}>
        <Icoon size={18} />
      </div>
      <div>
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-1">{titel}</p>
        <p className="font-serif text-2xl text-antraciet-800">{formaatBedrag(bedrag)}</p>
        {sub && <p className="font-sans text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Weekoverzicht modal ───────────────────────────────────
function WeekOverzichtModal({ open, onSluit }) {
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLaden(true);
    api.get('/finance/week-overzicht')
      .then(r => setData(r.data))
      .finally(() => setLaden(false));
  }, [open]);

  return (
    <Modal open={open} onSluit={onSluit} titel="Wekelijks betalingsoverzicht" breedte="max-w-2xl">
      {laden ? (
        <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
      ) : data ? (
        <div className="space-y-5">
          {/* Samenvatting */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-editorial px-4 py-3 text-center">
              <p className="font-sans text-xs text-gray-400 mb-1">Te ontvangen</p>
              <p className="font-serif text-lg text-green-700">{formaatBedrag(data.totaal_te_ontvangen)}</p>
            </div>
            <div className="bg-red-50 rounded-editorial px-4 py-3 text-center">
              <p className="font-sans text-xs text-gray-400 mb-1">Te betalen</p>
              <p className="font-serif text-lg text-red-700">{formaatBedrag(data.totaal_te_betalen)}</p>
            </div>
            <div className={`rounded-editorial px-4 py-3 text-center ${data.saldo >= 0 ? 'bg-cream-50' : 'bg-orange-50'}`}>
              <p className="font-sans text-xs text-gray-400 mb-1">Saldo</p>
              <p className={`font-serif text-lg ${data.saldo >= 0 ? 'text-antraciet-800' : 'text-orange-700'}`}>
                {formaatBedrag(data.saldo)}
              </p>
            </div>
          </div>

          {/* Items lijst */}
          <div>
            <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-3">Openstaande items</p>
            {data.items.length === 0 ? (
              <p className="font-sans text-sm text-gray-400 italic">Geen openstaande items</p>
            ) : (
              <div className="space-y-2">
                {data.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-cream-50 rounded-editorial px-4 py-3">
                    <div>
                      <p className="font-sans text-sm font-medium text-antraciet-800">{item.omschrijving}</p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">
                        {item.influencer_naam} · {format(parseISO(item.datum), 'd MMM yyyy', { locale: nl })}
                      </p>
                    </div>
                    <p className={`font-sans text-sm font-medium ${item.categorie_type === 'inkomsten' ? 'text-green-700' : 'text-red-600'}`}>
                      {item.categorie_type === 'inkomsten' ? '+' : '-'}{formaatBedrag(item.bedrag)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="font-sans text-xs text-gray-400">
            Gegenereerd op {format(new Date(data.gegenereerd), 'd MMMM yyyy HH:mm', { locale: nl })}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

// ── Periode filter ────────────────────────────────────────
function PeriodeFilter({ maand, jaar, onWijzig }) {
  const nu = new Date();
  const opties = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    opties.push({ maand: d.getMonth() + 1, jaar: d.getFullYear(), label: format(d, 'MMMM yyyy', { locale: nl }) });
  }

  return (
    <select
      className="input text-sm max-w-[180px]"
      value={`${jaar}-${maand}`}
      onChange={e => {
        const [j, m] = e.target.value.split('-');
        onWijzig(parseInt(m), parseInt(j));
      }}
    >
      <option value="-">Alle perioden</option>
      {opties.map(o => (
        <option key={`${o.jaar}-${o.maand}`} value={`${o.jaar}-${o.maand}`}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ════════════════════════════════════════════════════════════
// Hoofdpagina
// ════════════════════════════════════════════════════════════
export default function Financien() {
  const { isPA, isStaff } = useAuth();
  const nu = new Date();

  const [items, setItems]               = useState([]);
  const [samenvatting, setSamenvatting] = useState(null);
  const [laden, setLaden]               = useState(true);
  const [zoekterm, setZoekterm]         = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [betaaldFilter, setBetaaldFilter] = useState('');
  const [maand, setMaand]               = useState(nu.getMonth() + 1);
  const [jaar, setJaar]                 = useState(nu.getFullYear());
  const [periodeActief, setPeriodeActief] = useState(true);
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [nieuwOpen, setNieuwOpen]       = useState(false);
  const [weekOpen, setWeekOpen]         = useState(false);
  const [exportLaden, setExportLaden]   = useState(false);

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const params = {};
      if (zoekterm)     params.zoek   = zoekterm;
      if (typeFilter)   params.type   = typeFilter;
      if (betaaldFilter !== '') params.betaald = betaaldFilter;
      if (periodeActief) { params.maand = maand; params.jaar = jaar; }

      const [itemsRes, samRes] = await Promise.all([
        api.get('/finance', { params }),
        api.get('/finance/samenvatting', {
          params: periodeActief ? { maand, jaar } : {},
        }),
      ]);
      setItems(itemsRes.data);
      setSamenvatting(samRes.data);
    } finally {
      setLaden(false);
    }
  }, [zoekterm, typeFilter, betaaldFilter, maand, jaar, periodeActief]);

  useEffect(() => {
    const t = setTimeout(laadData, 300);
    return () => clearTimeout(t);
  }, [laadData]);

  async function maakNieuw(form) {
    const r = await api.post('/finance', form);
    setNieuwOpen(false);
    laadData();
    return r.data;
  }

  async function verwijder(id) {
    if (!window.confirm('Item definitief verwijderen?')) return;
    await api.delete(`/finance/${id}`);
    setDetailOpen(false);
    laadData();
  }

  async function downloadExport() {
    setExportLaden(true);
    try {
      const r = await api.get('/finance/maand-export', {
        params: { maand, jaar },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `financieel-overzicht-${jaar}-${String(maand).padStart(2, '0')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportLaden(false);
    }
  }

  function openDetail(item) {
    setGeselecteerd(item);
    setDetailOpen(true);
  }

  async function vernieuwtDetail() {
    if (!geselecteerd) return;
    const r = await api.get(`/finance/${geselecteerd.id}`);
    setGeselecteerd(r.data);
    laadData();
  }

  const maandNamen = ['','Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Koptekst ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Financiën</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Kosten, bonnetjes en betalingen — verkoopfacturen staan bij de manager</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setWeekOpen(true)} className="btn-secundair flex items-center gap-2 text-sm">
            <FileText size={15} />
            Week­overzicht
          </button>
          {isPA && periodeActief && (
            <button onClick={downloadExport} disabled={exportLaden} className="btn-secundair flex items-center gap-2 text-sm disabled:opacity-50">
              <Download size={15} />
              {exportLaden ? 'Exporteren...' : `Export ${maandNamen[maand]}`}
            </button>
          )}
          <button onClick={laadData} className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors" title="Vernieuwen">
            <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
          </button>
          {(isPA || isStaff) && (
            <button onClick={() => setNieuwOpen(true)} className="btn-primair flex items-center gap-2">
              <Plus size={16} />
              Toevoegen
            </button>
          )}
        </div>
      </div>

      {/* ── Samenvattingskaarten ── */}
      {samenvatting && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SamenvattingsKaart
            titel="Inkomsten"
            bedrag={samenvatting.totaal_inkomsten}
            icoon={TrendingUp}
            kleur="bg-green-50 text-green-500"
            sub={samenvatting.openstaand_inkomsten > 0 ? `${formaatBedrag(samenvatting.openstaand_inkomsten)} nog te ontvangen` : 'Alles ontvangen'}
          />
          <SamenvattingsKaart
            titel="Uitgaven"
            bedrag={samenvatting.totaal_uitgaven}
            icoon={TrendingDown}
            kleur="bg-roos-100 text-roos-400"
            sub={samenvatting.openstaand_uitgaven > 0 ? `${formaatBedrag(samenvatting.openstaand_uitgaven)} nog te betalen` : 'Alles betaald'}
          />
          <SamenvattingsKaart
            titel="Saldo"
            bedrag={samenvatting.saldo}
            icoon={Minus}
            kleur={samenvatting.saldo >= 0 ? 'bg-cream-200 text-goud-600' : 'bg-orange-50 text-orange-500'}
            sub={`${samenvatting.totaal_items} items${periodeActief ? ` in ${maandNamen[maand]}` : ''}`}
          />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" className="input pl-9 text-sm max-w-[220px]"
            placeholder="Zoeken..."
            value={zoekterm} onChange={e => setZoekterm(e.target.value)}
          />
        </div>

        <select className="input text-sm max-w-[150px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Alle typen</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className="input text-sm max-w-[150px]" value={betaaldFilter} onChange={e => setBetaaldFilter(e.target.value)}>
          <option value="">Alle status</option>
          <option value="false">Onbetaald</option>
          <option value="true">Betaald</option>
        </select>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={periodeActief}
            onChange={e => setPeriodeActief(e.target.checked)}
            className="w-4 h-4 accent-goud-500"
          />
          <span className="font-sans text-sm text-antraciet-700">Filter op maand</span>
        </label>

        {periodeActief && (
          <PeriodeFilter
            maand={maand} jaar={jaar}
            onWijzig={(m, j) => { setMaand(m); setJaar(j); }}
          />
        )}
      </div>

      {/* ── Tabel ── */}
      <div className="card p-0 overflow-hidden">
        {laden ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="font-sans text-sm">Laden...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <FileText size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">Geen items gevonden</p>
            <p className="font-sans text-sm mt-1">Pas de filters aan of voeg een nieuw item toe</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Omschrijving</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Datum</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Categorie</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Bedrag</th>
                  <th className="px-4 py-3 text-center font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Betaald</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="border-b border-cream-200 hover:bg-cream-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="font-sans text-sm font-medium text-antraciet-800 group-hover:text-goud-600 transition-colors">
                        {item.omschrijving}
                      </p>
                      {item.opdrachtgever && (
                        <p className="font-sans text-xs text-gray-400 mt-0.5">{item.opdrachtgever}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="badge bg-cream-100 text-antraciet-600 border border-cream-200 font-sans">
                        {typeLabels[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
                      {format(parseISO(item.datum), 'd MMM yyyy', { locale: nl })}
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-gray-500">
                      {item.categorie_naam || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-sans text-sm font-medium ${item.categorie_type === 'inkomsten' ? 'text-green-700' : 'text-antraciet-800'}`}>
                        {item.categorie_type === 'inkomsten' ? '+' : ''}{formaatBedrag(item.bedrag, item.valuta)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {item.betaald
                        ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                        : <Circle size={16} className="text-gray-300 mx-auto" />
                      }
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
                      {item.influencer_naam}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail slide-over ── */}
      <SlideOver
        open={detailOpen}
        onSluit={() => { setDetailOpen(false); setGeselecteerd(null); }}
        titel={geselecteerd?.omschrijving || 'Detail'}
      >
        {geselecteerd && (
          <FinancieelDetail
            item={geselecteerd}
            onVernieuwd={vernieuwtDetail}
            onVerwijder={verwijder}
          />
        )}
      </SlideOver>

      {/* ── Nieuw item modal ── */}
      <Modal open={nieuwOpen} onSluit={() => setNieuwOpen(false)} titel="Nieuw financieel item">
        <FinancieelFormulier
          onOpslaan={maakNieuw}
          onAnnuleer={() => setNieuwOpen(false)}
        />
      </Modal>

      {/* ── Weekoverzicht modal ── */}
      <WeekOverzichtModal open={weekOpen} onSluit={() => setWeekOpen(false)} />
    </div>
  );
}
