import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Plus, Search, RefreshCw, Handshake, Archive, Receipt } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useInfluencer } from '../context/InfluencerContext';
import SlideOver from '../components/UI/SlideOver';
import Modal from '../components/UI/Modal';
import SamenwerkingFormulier from '../components/Samenwerkingen/SamenwerkingFormulier';
import SamenwerkingDetail from '../components/Samenwerkingen/SamenwerkingDetail';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

const statusStijl = {
  aanvraag:     'bg-cream-200 text-antraciet-700 border border-cream-300',
  bevestigd:    'bg-blue-50 text-blue-700 border border-blue-100',
  in_productie: 'bg-amber-50 text-amber-700 border border-amber-100',
  gepost:       'bg-green-50 text-green-700 border border-green-100',
  afgerond:     'bg-gray-50 text-gray-500 border border-gray-200',
  geannuleerd:  'bg-red-50 text-red-600 border border-red-100',
};

const statusLabel = {
  aanvraag: 'Aanvraag', bevestigd: 'Bevestigd', in_productie: 'In productie',
  gepost: 'Gepost', afgerond: 'Afgerond', geannuleerd: 'Geannuleerd',
};

function FactuurStempel({ samenwerking }) {
  if (!samenwerking.verkoopfactuur_nummer) {
    return <span className="font-sans text-xs text-gray-300">—</span>;
  }
  const vrijgegeven = samenwerking.influencer_vrijgegeven === 1;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Receipt size={13} className={vrijgegeven ? 'text-green-600' : 'text-goud-500'} />
      <span className="font-sans text-xs text-antraciet-700">{samenwerking.verkoopfactuur_nummer}</span>
    </span>
  );
}

export default function Samenwerkingen() {
  const { isPA, isManager, isStaff } = useAuth();
  const { actiefId, actief, params } = useInfluencer();

  const [tab, setTab]                 = useState('lopend');
  const [items, setItems]             = useState([]);
  const [laden, setLaden]             = useState(true);
  const [zoekterm, setZoekterm]       = useState('');
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [nieuwOpen, setNieuwOpen]     = useState(false);

  const magToevoegen = isPA || isManager || isStaff;

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const r = await api.get('/collaborations', {
        params: { ...params, archief: tab === 'archief', ...(zoekterm ? { zoek: zoekterm } : {}) },
      });
      setItems(r.data);
    } finally {
      setLaden(false);
    }
  }, [params, tab, zoekterm]);

  useEffect(() => {
    const t = setTimeout(laadData, 250);
    return () => clearTimeout(t);
  }, [laadData]);

  async function openDetail(item) {
    const r = await api.get(`/collaborations/${item.id}`);
    setGeselecteerd(r.data);
    setDetailOpen(true);
  }

  async function vernieuwDetail() {
    if (!geselecteerd) return;
    const r = await api.get(`/collaborations/${geselecteerd.id}`);
    setGeselecteerd(r.data);
    laadData();
  }

  async function maakNieuw(form) {
    await api.post('/collaborations', form);
    setNieuwOpen(false);
    laadData();
  }

  async function verwijder(id) {
    if (!window.confirm('Samenwerking definitief verwijderen?')) return;
    await api.delete(`/collaborations/${id}`);
    setDetailOpen(false);
    laadData();
  }

  const totaal = items.reduce((som, i) => som + (i.bedrag || 0), 0);

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Koptekst ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Samenwerkingen</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            {actief ? actief.naam : 'Alle influencers'} · {items.length} samenwerking{items.length === 1 ? '' : 'en'}
            {totaal > 0 && ` · ${formaatBedrag(totaal)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={laadData}
            className="p-2.5 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={16} className={laden ? 'animate-spin' : ''} />
          </button>
          {magToevoegen && (
            <button onClick={() => setNieuwOpen(true)} className="btn-primair flex items-center gap-2">
              <Plus size={16} />
              Nieuwe samenwerking
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs: front / archief ── */}
      <div className="flex items-center gap-1 border-b border-cream-200">
        {[
          { sleutel: 'lopend',  label: 'Lopend',  icoon: Handshake },
          { sleutel: 'archief', label: 'Archief', icoon: Archive },
        ].map(({ sleutel, label, icoon: Icoon }) => (
          <button
            key={sleutel}
            onClick={() => setTab(sleutel)}
            className={`flex items-center gap-2 px-4 py-2.5 font-sans text-sm border-b-2 -mb-px transition-colors ${
              tab === sleutel
                ? 'border-goud-500 text-antraciet-800 font-medium'
                : 'border-transparent text-gray-400 hover:text-antraciet-700'
            }`}
          >
            <Icoon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Zoeken ── */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" className="input pl-9 text-sm max-w-[260px]"
          placeholder="Zoek op titel of klant..."
          value={zoekterm} onChange={e => setZoekterm(e.target.value)}
        />
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
            <Handshake size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">
              {tab === 'archief' ? 'Nog niets in het archief' : 'Geen lopende samenwerkingen'}
            </p>
            <p className="font-sans text-sm mt-1">
              {tab === 'archief'
                ? 'Afgeronde samenwerkingen komen hier automatisch terecht'
                : 'Voeg een nieuwe samenwerking toe om te beginnen'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Samenwerking</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {tab === 'archief' ? 'Gepost' : 'Deadline'}
                  </th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Factuur</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Bedrag</th>
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
                        {item.titel}
                      </p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">{item.klant}</p>
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{item.influencer_naam}</td>
                    <td className="px-4 py-4">
                      <span className={`badge font-sans ${statusStijl[item.status] || ''}`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
                      {(() => {
                        const d = tab === 'archief' ? item.post_datum : item.deadline;
                        if (!d) return <span className="text-gray-300">—</span>;
                        try { return format(parseISO(d), 'd MMM yyyy', { locale: nl }); } catch { return d; }
                      })()}
                    </td>
                    <td className="px-4 py-4"><FactuurStempel samenwerking={item} /></td>
                    <td className="px-4 py-4 text-right font-sans text-sm font-medium text-antraciet-800">
                      {formaatBedrag(item.bedrag, item.valuta)}
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
        titel={geselecteerd?.titel || 'Samenwerking'}
      >
        {geselecteerd && (
          <SamenwerkingDetail
            samenwerking={geselecteerd}
            onVernieuwd={vernieuwDetail}
            onVerwijder={verwijder}
          />
        )}
      </SlideOver>

      {/* ── Nieuw ── */}
      <Modal open={nieuwOpen} onSluit={() => setNieuwOpen(false)} titel="Nieuwe samenwerking" breedte="max-w-2xl">
        <SamenwerkingFormulier onOpslaan={maakNieuw} onAnnuleer={() => setNieuwOpen(false)} />
      </Modal>
    </div>
  );
}
