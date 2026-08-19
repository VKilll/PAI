import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Plus, RefreshCw, Receipt, Send, Trash2, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useInfluencer } from '../context/InfluencerContext';
import Modal from '../components/UI/Modal';
import InfluencerFactuurFormulier from '../components/Facturen/InfluencerFactuurFormulier';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

const statusStijl = {
  concept:     'bg-cream-200 text-antraciet-700 border border-cream-300',
  verzonden:   'bg-amber-50 text-amber-700 border border-amber-100',
  betaald:     'bg-green-50 text-green-700 border border-green-100',
  geannuleerd: 'bg-red-50 text-red-600 border border-red-100',
};

export default function MijnFacturen() {
  const { isPA, isInfluencer } = useAuth();
  const { actief, actiefId, params, kiesInfluencer } = useInfluencer();
  const [zoekParams, setZoekParams] = useSearchParams();

  const [items, setItems]         = useState([]);
  const [laden, setLaden]         = useState(true);
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [voorgeselecteerd, setVoorgeselecteerd] = useState(null);
  const [melding, setMelding]     = useState(null);
  const [fout, setFout]           = useState(null);

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const r = await api.get('/influencer-invoices', { params });
      setItems(r.data);
    } finally {
      setLaden(false);
    }
  }, [params]);

  useEffect(() => { laadData(); }, [laadData]);

  // Diepe link vanuit de pop-up: /mijn-facturen?influencer=2&samenwerking=5
  useEffect(() => {
    const influencer = zoekParams.get('influencer');
    const samenwerking = zoekParams.get('samenwerking');
    if (!influencer && !samenwerking) return;

    if (influencer) kiesInfluencer(Number(influencer));
    if (samenwerking) { setVoorgeselecteerd(samenwerking); setNieuwOpen(true); }

    zoekParams.delete('influencer');
    zoekParams.delete('samenwerking');
    setZoekParams(zoekParams, { replace: true });
  }, [zoekParams, setZoekParams, kiesInfluencer]);

  async function maakNieuw(form) {
    await api.post('/influencer-invoices', form);
    setNieuwOpen(false);
    setVoorgeselecteerd(null);
    setMelding('Conceptfactuur aangemaakt. Controleer hem en verstuur hem naar het management.');
    laadData();
  }

  async function verstuur(factuur) {
    setFout(null);
    try {
      const r = await api.post(`/influencer-invoices/${factuur.id}/versturen`);
      setMelding(
        r.data.mail.status === 'verzonden'
          ? `Factuur ${factuur.factuurnummer} is gemaild naar ${r.data.factuur.ontvanger}.`
          : r.data.mail.status === 'niet_geconfigureerd'
            ? `Factuur ${factuur.factuurnummer} staat op verzonden. Let op: er is nog geen SMTP ingesteld, dus de mail is niet daadwerkelijk verstuurd.`
            : `Factuur staat op verzonden, maar de mail is mislukt: ${r.data.mail.fout}`
      );
      laadData();
    } catch (err) {
      setFout(err.response?.data?.error || 'Versturen mislukt');
    }
  }

  async function verwijder(factuur) {
    if (!window.confirm('Conceptfactuur verwijderen?')) return;
    await api.delete(`/influencer-invoices/${factuur.id}`);
    laadData();
  }

  async function markeerBetaald(factuur) {
    await api.patch(`/influencer-invoices/${factuur.id}/betaald`, { betaald: true }).catch(() => {});
    laadData();
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      {/* ── Koptekst ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">
            {isPA ? 'Facturen influencers' : 'Mijn facturen'}
          </h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            {isPA
              ? `Facturen namens ${actief ? actief.naam : 'de influencers'} aan het management`
              : 'Jouw facturen aan het management'}
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
          <button
            onClick={() => { setVoorgeselecteerd(null); setNieuwOpen(true); }}
            className="btn-primair flex items-center gap-2"
          >
            <Plus size={16} />
            Nieuwe factuur
          </button>
        </div>
      </div>

      {melding && (
        <p className="font-sans text-sm text-goud-700 bg-cream-100 border border-cream-300 rounded-editorial px-4 py-3">
          {melding}
        </p>
      )}
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-4 py-3">{fout}</p>
      )}
      {isPA && !actiefId && (
        <p className="font-sans text-sm text-gray-500 bg-cream-50 border border-cream-200 rounded-editorial px-4 py-3">
          Kies bovenin een influencer om een factuur namens haar of hem op te stellen.
        </p>
      )}

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
            <p className="font-serif text-lg">Nog geen facturen</p>
            <p className="font-sans text-sm mt-1">
              Zodra de manager een samenwerking heeft gefactureerd, kun je hier je eigen factuur opstellen
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Factuur</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Samenwerking</th>
                  {isPA && <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>}
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Datum</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Totaal</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Actie</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map(f => (
                  <tr key={f.id} className="border-b border-cream-200 hover:bg-cream-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-sans text-sm font-medium text-antraciet-800">{f.factuurnummer}</p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">
                        naar {f.ontvanger}
                        {f.aangemaakt_namens === 'pa' && ' · door de PA'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-sans text-sm text-antraciet-700">{f.samenwerking_titel}</p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">{f.klant}</p>
                    </td>
                    {isPA && <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{f.influencer_naam}</td>}
                    <td className="px-4 py-4 font-sans text-sm text-antraciet-700">
                      {(() => {
                        try { return format(parseISO(f.factuurdatum), 'd MMM yyyy', { locale: nl }); }
                        catch { return f.factuurdatum; }
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge font-sans ${statusStijl[f.status] || ''}`}>{f.status}</span>
                      {f.email_status === 'mislukt' && (
                        <p className="font-sans text-[10px] text-red-600 mt-1">mail mislukt</p>
                      )}
                      {f.email_status === 'niet_geconfigureerd' && (
                        <p className="font-sans text-[10px] text-gray-400 mt-1">geen SMTP</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-sans text-sm font-medium text-antraciet-800">
                      {formaatBedrag(f.totaal, f.valuta)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {f.status === 'concept' && (
                          <>
                            <button
                              onClick={() => verstuur(f)}
                              className="p-2 text-goud-600 hover:bg-cream-200 rounded-editorial transition-colors"
                              title="Versturen naar het management"
                            >
                              <Send size={15} />
                            </button>
                            <button
                              onClick={() => verwijder(f)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-editorial transition-colors"
                              title="Verwijderen"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {f.status === 'verzonden' && isPA && (
                          <button
                            onClick={() => markeerBetaald(f)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-editorial transition-colors"
                            title="Markeer als betaald"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {f.status === 'verzonden' && isInfluencer && (
                          <span className="font-sans text-xs text-gray-400 px-2">verstuurd</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Nieuwe factuur ── */}
      <Modal
        open={nieuwOpen}
        onSluit={() => { setNieuwOpen(false); setVoorgeselecteerd(null); }}
        titel="Nieuwe factuur"
        breedte="max-w-2xl"
      >
        <InfluencerFactuurFormulier
          influencerId={actiefId}
          voorgeselecteerd={voorgeselecteerd}
          onOpslaan={maakNieuw}
          onAnnuleer={() => { setNieuwOpen(false); setVoorgeselecteerd(null); }}
        />
      </Modal>
    </div>
  );
}
