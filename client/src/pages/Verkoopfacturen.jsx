import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Search, RefreshCw, Receipt, FileCheck2, Send, Euro } from 'lucide-react';
import api from '../utils/api';
import { useInfluencer } from '../context/InfluencerContext';
import SlideOver from '../components/UI/SlideOver';
import VerkoopfactuurDetail from '../components/Facturen/VerkoopfactuurDetail';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

const statusStijl = {
  concept:     'bg-cream-200 text-antraciet-700 border border-cream-300',
  goedgekeurd: 'bg-blue-50 text-blue-700 border border-blue-100',
  verzonden:   'bg-amber-50 text-amber-700 border border-amber-100',
  betaald:     'bg-green-50 text-green-700 border border-green-100',
  geannuleerd: 'bg-red-50 text-red-600 border border-red-100',
};

const statusLabel = {
  concept: 'Concept', goedgekeurd: 'Goedgekeurd', verzonden: 'Verzonden',
  betaald: 'Betaald', geannuleerd: 'Geannuleerd',
};

function Kaart({ titel, waarde, sub, icoon: Icoon, kleur }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${kleur}`}>
        <Icoon size={18} />
      </div>
      <div>
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-1">{titel}</p>
        <p className="font-serif text-2xl text-antraciet-800">{waarde}</p>
        {sub && <p className="font-sans text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Verkoopfacturen() {
  const { actief, params } = useInfluencer();
  const [zoekParams, setZoekParams] = useSearchParams();

  const [items, setItems]           = useState([]);
  const [samenvatting, setSamenvatting] = useState(null);
  const [laden, setLaden]           = useState(true);
  const [zoekterm, setZoekterm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const [lijst, sam] = await Promise.all([
        api.get('/sales-invoices', {
          params: { ...params, ...(statusFilter ? { status: statusFilter } : {}), ...(zoekterm ? { zoek: zoekterm } : {}) },
        }),
        api.get('/sales-invoices/samenvatting', { params }),
      ]);
      setItems(lijst.data);
      setSamenvatting(sam.data);
    } finally {
      setLaden(false);
    }
  }, [params, statusFilter, zoekterm]);

  useEffect(() => {
    const t = setTimeout(laadData, 250);
    return () => clearTimeout(t);
  }, [laadData]);

  const openDetail = useCallback(async (id) => {
    const r = await api.get(`/sales-invoices/${id}`);
    setGeselecteerd(r.data);
    setDetailOpen(true);
  }, []);

  // Diepe link vanuit de pop-up: /verkoopfacturen?factuur=12
  useEffect(() => {
    const id = zoekParams.get('factuur');
    if (!id) return;
    openDetail(id).catch(() => {});
    zoekParams.delete('factuur');
    setZoekParams(zoekParams, { replace: true });
  }, [zoekParams, setZoekParams, openDetail]);

  async function vernieuwDetail() {
    if (!geselecteerd) return;
    const r = await api.get(`/sales-invoices/${geselecteerd.id}`);
    setGeselecteerd(r.data);
    laadData();
  }

  async function verwijder(id) {
    if (!window.confirm('Conceptfactuur verwijderen?')) return;
    await api.delete(`/sales-invoices/${id}`);
    setDetailOpen(false);
    laadData();
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Koptekst ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Verkoopfacturen</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Facturen aan de klant · {actief ? actief.naam : 'alle influencers'}
          </p>
        </div>
        <button
          onClick={laadData}
          className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
          title="Vernieuwen"
        >
          <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Samenvatting ── */}
      {samenvatting && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Kaart
            titel="Te controleren" icoon={FileCheck2} kleur="bg-cream-200 text-goud-600"
            waarde={formaatBedrag(samenvatting.concept_bedrag)}
            sub={`${samenvatting.aantal_concept} concept · ${samenvatting.aantal_goedgekeurd} goedgekeurd`}
          />
          <Kaart
            titel="Openstaand" icoon={Send} kleur="bg-amber-50 text-amber-600"
            waarde={formaatBedrag(samenvatting.openstaand_bedrag)}
            sub="verstuurd, nog niet betaald"
          />
          <Kaart
            titel="Betaald" icoon={Euro} kleur="bg-green-50 text-green-600"
            waarde={formaatBedrag(samenvatting.betaald_bedrag)}
            sub={`${samenvatting.totaal_facturen} facturen totaal`}
          />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" className="input pl-9 text-sm max-w-[240px]"
            placeholder="Zoek op nummer of klant..."
            value={zoekterm} onChange={e => setZoekterm(e.target.value)}
          />
        </div>
        <select className="input text-sm max-w-[170px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Alle status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
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
            <Receipt size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">Geen verkoopfacturen</p>
            <p className="font-sans text-sm mt-1">
              Zodra een samenwerking is gepost, staat de factuur hier automatisch als concept klaar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Factuur</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Klant</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Datum</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer mag factureren</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Totaal</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map(f => (
                  <tr
                    key={f.id}
                    onClick={() => openDetail(f.id)}
                    className="border-b border-cream-200 hover:bg-cream-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="font-sans text-sm font-medium text-antraciet-800 group-hover:text-goud-600 transition-colors">
                        {f.factuurnummer}
                      </p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">{f.omschrijving}</p>
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{f.klant}</td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{f.influencer_naam}</td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
                      {(() => {
                        try { return format(parseISO(f.factuurdatum), 'd MMM yyyy', { locale: nl }); }
                        catch { return f.factuurdatum; }
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge font-sans ${statusStijl[f.status] || ''}`}>
                        {statusLabel[f.status] || f.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {f.influencer_vrijgegeven
                        ? <span className="font-sans text-xs text-green-700">Vrijgegeven{f.influencer_facturen > 0 ? ' · factuur binnen' : ''}</span>
                        : <span className="font-sans text-xs text-gray-300">Nog niet</span>}
                    </td>
                    <td className="px-4 py-4 text-right font-sans text-sm font-medium text-antraciet-800">
                      {formaatBedrag(f.totaal, f.valuta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail ── */}
      <SlideOver
        open={detailOpen}
        onSluit={() => { setDetailOpen(false); setGeselecteerd(null); }}
        titel={geselecteerd ? `Factuur ${geselecteerd.factuurnummer}` : 'Factuur'}
      >
        {geselecteerd && (
          <VerkoopfactuurDetail
            factuur={geselecteerd}
            onVernieuwd={vernieuwDetail}
            onVerwijder={verwijder}
          />
        )}
      </SlideOver>
    </div>
  );
}
