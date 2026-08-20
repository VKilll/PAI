import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Sun, RefreshCw, CheckCircle2, XCircle, CalendarClock, ArrowUpRight,
  Handshake, Camera, Package, Receipt, AlertTriangle
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useInfluencer } from '../context/InfluencerContext';
import Modal from '../components/UI/Modal';

const icoonPerBron = {
  collaboration:      Handshake,
  content_post:       Camera,
  package:            Package,
  sales_invoice:      Receipt,
  influencer_invoice: Receipt,
};

// De dag zelf blijft altijd zichtbaar; hoe ver weg die ligt staat erachter.
function datumLabel(datum) {
  try {
    const d = parseISO(datum);
    const dag = format(d, 'EEEE d MMMM', { locale: nl });
    const verschil = differenceInCalendarDays(d, new Date());

    if (verschil === 0)  return `${dag} · vandaag`;
    if (verschil === 1)  return `${dag} · morgen`;
    if (verschil === -1) return `${dag} · gisteren`;
    if (verschil < 0)    return `${dag} · ${Math.abs(verschil)} dagen te laat`;
    return `${dag} · over ${verschil} dagen`;
  } catch {
    return datum;
  }
}

// ── Eén regel in de lijst ─────────────────────────────────────
function AgendaRegel({ item, onBeslis, bezig }) {
  const Icoon = icoonPerBron[item.bron_type] || CalendarClock;
  const [verschuifOpen, setVerschuifOpen] = useState(false);
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-cream-200 last:border-0 hover:bg-cream-50 transition-colors">
      <span className="w-8 h-8 rounded-full bg-cream-200 text-antraciet-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icoon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="font-sans text-sm font-medium text-antraciet-800">{item.titel}</p>
          <span className="font-sans text-xs text-goud-600">{item.influencer_naam}</span>
          {item.verschoven && (
            <span className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">verschoven</span>
          )}
        </div>
        {item.toelichting && (
          <p className="font-sans text-xs text-gray-500 mt-0.5">{item.toelichting}</p>
        )}
        <p className="font-sans text-xs text-gray-400 mt-1">{datumLabel(item.datum)}</p>

        {verschuifOpen && (
          <div className="flex gap-2 mt-2">
            <input
              type="date" className="input text-sm max-w-[160px]"
              value={datum} onChange={e => setDatum(e.target.value)}
            />
            <button
              onClick={() => { onBeslis(item, 'verschoven', datum); setVerschuifOpen(false); }}
              className="btn-primair text-sm px-3"
            >
              Verschuif
            </button>
            <button onClick={() => setVerschuifOpen(false)} className="btn-secundair text-sm px-3">
              Terug
            </button>
          </div>
        )}
      </div>

      {!verschuifOpen && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.link && (
            <Link
              to={item.link}
              className="p-2 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors"
              title="Openen"
            >
              <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            onClick={() => onBeslis(item, 'gedaan')}
            disabled={bezig}
            className="p-2 text-green-600 hover:bg-green-50 rounded-editorial transition-colors disabled:opacity-40"
            title="Gedaan"
          >
            <CheckCircle2 size={16} />
          </button>
          <button
            onClick={() => setVerschuifOpen(true)}
            disabled={bezig}
            className="p-2 text-gray-400 hover:text-antraciet-800 hover:bg-cream-200 rounded-editorial transition-colors disabled:opacity-40"
            title="Verschuiven"
          >
            <CalendarClock size={16} />
          </button>
          <button
            onClick={() => onBeslis(item, 'vervallen')}
            disabled={bezig}
            className="p-2 text-red-500 hover:bg-red-50 rounded-editorial transition-colors disabled:opacity-40"
            title="Vervalt"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Blok({ titel, items, leeg, onBeslis, bezig, accent }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className={`px-4 py-3 border-b border-cream-200 flex items-center justify-between ${accent || 'bg-cream-50'}`}>
        <p className="font-serif text-base text-antraciet-800">{titel}</p>
        <span className="font-sans text-xs text-gray-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-gray-400 px-4 py-6 text-center">{leeg}</p>
      ) : (
        items.map(i => (
          <AgendaRegel
            key={`${i.bron_type}-${i.bron_id}-${i.soort}`}
            item={i} onBeslis={onBeslis} bezig={bezig}
          />
        ))
      )}
    </div>
  );
}

export default function Vandaag() {
  const { gebruiker } = useAuth();
  const { actief, params } = useInfluencer();

  const [agenda, setAgenda]   = useState({ vandaag: [], achterstallig: [], komend: [] });
  const [laden, setLaden]     = useState(true);
  const [bezig, setBezig]     = useState(false);
  const [controle, setControle] = useState(null);

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const r = await api.get('/agenda', { params });
      setAgenda(r.data);
    } finally {
      setLaden(false);
    }
  }, [params]);

  useEffect(() => { laadData(); }, [laadData]);

  // Eén keer per dag: is alles van gisteren ook echt gebeurd?
  useEffect(() => {
    api.get('/agenda/controle')
      .then(r => { if (r.data.nodig) setControle(r.data.achterstallig); })
      .catch(() => {});
  }, []);

  async function beslis(item, beslissing, nieuweDatum) {
    setBezig(true);
    try {
      const r = await api.post('/agenda/beslissing', {
        bron_type: item.bron_type,
        bron_id: item.bron_id,
        soort: item.soort,
        beslissing,
        nieuwe_datum: nieuweDatum,
      });
      setAgenda(r.data.agenda);
      setControle(huidig => huidig?.filter(
        i => !(i.bron_type === item.bron_type && i.bron_id === item.bron_id && i.soort === item.soort)
      ) ?? null);
    } finally {
      setBezig(false);
    }
  }

  async function sluitControle() {
    await api.post('/agenda/controle/klaar').catch(() => {});
    setControle(null);
    laadData();
  }

  const uur = new Date().getHours();
  const groet = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';

  return (
    <div className="p-8 space-y-6 max-w-5xl">

      {/* ── Kop ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">
            {groet}, {gebruiker?.naam?.split(' ')[0]}.
          </h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })}
            {actief && ` · ${actief.naam}`}
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

      {/* ── Achterstallig ──
          Zolang de dagelijkse controle openstaat laten we dit blok weg; die
          punten staan dan al in de pop-up en horen niet twee keer op het scherm. */}
      {agenda.achterstallig.length > 0 && !controle?.length && (
        <Blok
          titel="Achterstallig"
          accent="bg-orange-50"
          items={agenda.achterstallig}
          leeg=""
          onBeslis={beslis}
          bezig={bezig}
        />
      )}

      {/* ── Vandaag ── */}
      <Blok
        titel="Vandaag"
        items={agenda.vandaag}
        leeg="Niets op de planning voor vandaag."
        onBeslis={beslis}
        bezig={bezig}
      />

      {/* ── Komende dagen ── */}
      <Blok
        titel="Komende dagen"
        items={agenda.komend}
        leeg="Niets in de komende week."
        onBeslis={beslis}
        bezig={bezig}
      />

      <p className="font-sans text-xs text-gray-400 flex items-start gap-1.5">
        <Sun size={13} className="flex-shrink-0 mt-0.5" />
        Deze lijst komt rechtstreeks uit de samenwerkingen, posts, pakketten en facturen. Er is dus geen aparte
        takenlijst die kan gaan afwijken, elk punt hoort bij precies één influencer, en elke samenwerking staat
        op hooguit één regel: het eerstvolgende dat moet gebeuren, op zijn eigen dag.
      </p>

      {/* ── Dagelijkse controle ── */}
      <Modal
        open={Boolean(controle?.length)}
        onSluit={sluitControle}
        titel="Is dit allemaal gebeurd?"
        breedte="max-w-2xl"
      >
        {controle?.length > 0 && (
          <div className="space-y-4">
            <p className="font-sans text-sm text-gray-500 flex gap-2">
              <AlertTriangle size={15} className="text-goud-500 flex-shrink-0 mt-0.5" />
              Deze punten stonden op een dag die inmiddels voorbij is. Geef per punt aan of het gedaan is,
              verschoven moet worden of vervalt.
            </p>
            <div className="border border-cream-200 rounded-editorial overflow-hidden">
              {controle.map(i => (
                <AgendaRegel
                  key={`${i.bron_type}-${i.bron_id}-${i.soort}`}
                  item={i} onBeslis={beslis} bezig={bezig}
                />
              ))}
            </div>
            <button onClick={sluitControle} className="btn-secundair w-full">
              Rest later — vandaag niet meer vragen
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
