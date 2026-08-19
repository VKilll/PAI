import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Plus, RefreshCw, FileText, Upload, Sparkles, Link2, CheckSquare,
  Square, Trash2, AlertTriangle, Search
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useInfluencer } from '../context/InfluencerContext';
import { samenwerkingLabel } from '../utils/labels';
import Modal from '../components/UI/Modal';
import SlideOver from '../components/UI/SlideOver';

function formaatBedrag(bedrag) {
  if (bedrag == null) return '—';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag);
}

function datum(waarde, patroon = 'd MMM yyyy') {
  if (!waarde) return '—';
  try { return format(parseISO(waarde), patroon, { locale: nl }); } catch { return waarde; }
}

function lijst(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

const aiStatusTekst = {
  niet_gedraaid: { label: 'Niet uitgelezen', kleur: 'bg-cream-200 text-antraciet-700 border border-cream-300' },
  klaar:         { label: 'Uitgelezen',      kleur: 'bg-green-50 text-green-700 border border-green-100' },
  handmatig:     { label: 'Basis-uitlezing', kleur: 'bg-amber-50 text-amber-700 border border-amber-100' },
  mislukt:       { label: 'Mislukt',         kleur: 'bg-red-50 text-red-600 border border-red-100' },
  bezig:         { label: 'Bezig',           kleur: 'bg-blue-50 text-blue-700 border border-blue-100' },
};

// ── Nieuwe briefing: bestand of tekst ─────────────────────────
function NieuwModal({ open, onSluit, onKlaar, influencers, actiefId }) {
  const [tab, setTab]   = useState('bestand');
  const [form, setForm] = useState({ influencer_id: actiefId || '', opdrachtgever: '', titel: '', ruwe_tekst: '' });
  const [bestand, setBestand] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout]   = useState(null);

  useEffect(() => {
    if (open) setForm(f => ({ ...f, influencer_id: actiefId || f.influencer_id }));
  }, [open, actiefId]);

  const wijzig = (veld, waarde) => setForm(f => ({ ...f, [veld]: waarde }));

  async function opslaan(e) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      let briefing;
      if (tab === 'bestand') {
        if (!bestand) throw new Error('Kies een bestand');
        const data = new FormData();
        data.append('bestand', bestand);
        data.append('influencer_id', form.influencer_id);
        data.append('opdrachtgever', form.opdrachtgever);
        data.append('titel', form.titel);
        const r = await api.post('/briefings/upload', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        briefing = r.data;
      } else {
        const r = await api.post('/briefings', form, { timeout: 120000 });
        briefing = r.data;
      }
      setForm({ influencer_id: actiefId || '', opdrachtgever: '', titel: '', ruwe_tekst: '' });
      setBestand(null);
      onKlaar(briefing);
      onSluit();
    } catch (err) {
      setFout(err.response?.data?.error || err.message || 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onSluit={onSluit} titel="Nieuwe briefing" breedte="max-w-2xl">
      <form onSubmit={opslaan} className="space-y-4">
        {fout && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
        )}

        <div className="flex gap-1 border-b border-cream-200">
          {[{ k: 'bestand', l: 'PDF uploaden' }, { k: 'tekst', l: 'Tekst plakken' }].map(t => (
            <button
              key={t.k} type="button" onClick={() => setTab(t.k)}
              className={`px-4 py-2 font-sans text-sm border-b-2 -mb-px transition-colors ${
                tab === t.k ? 'border-goud-500 text-antraciet-800 font-medium' : 'border-transparent text-gray-400'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Influencer *</label>
            <select
              className="input" required value={form.influencer_id}
              onChange={e => wijzig('influencer_id', Number(e.target.value))}
            >
              <option value="">Kies</option>
              {influencers.map(i => <option key={i.id} value={i.id}>{i.naam}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Opdrachtgever {tab === 'tekst' && '*'}</label>
            <input
              type="text" className="input" required={tab === 'tekst'}
              value={form.opdrachtgever} onChange={e => wijzig('opdrachtgever', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Titel {tab === 'tekst' && '*'}</label>
          <input
            type="text" className="input" required={tab === 'tekst'}
            placeholder={tab === 'bestand' ? 'Leeg laten = bestandsnaam' : ''}
            value={form.titel} onChange={e => wijzig('titel', e.target.value)}
          />
        </div>

        {tab === 'bestand' ? (
          <div>
            <label className="label">Briefing (PDF of tekstbestand) *</label>
            <input
              type="file" accept=".pdf,.txt,.md,.csv"
              onChange={e => setBestand(e.target.files[0])}
              className="block w-full font-sans text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-editorial file:border-0 file:bg-cream-200 file:text-antraciet-800 file:font-sans file:text-sm hover:file:bg-cream-300"
            />
          </div>
        ) : (
          <div>
            <label className="label">Briefingtekst *</label>
            <textarea
              className="input font-sans text-sm" rows={10} required
              placeholder="Plak hier de mail of de briefing..."
              value={form.ruwe_tekst} onChange={e => wijzig('ruwe_tekst', e.target.value)}
            />
          </div>
        )}

        <p className="font-sans text-xs text-gray-400 flex gap-2">
          <Sparkles size={14} className="text-goud-500 flex-shrink-0 mt-0.5" />
          Na het opslaan wordt de briefing uitgelezen: livedatum, deadline, deliverables, hashtags, vermeldingen,
          vergoeding en exclusiviteit. Je kunt alles daarna zelf nog bijstellen.
        </p>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={bezig} className="btn-primair flex-1 disabled:opacity-50">
            {bezig ? 'Uitlezen...' : 'Opslaan en uitlezen'}
          </button>
          <button type="button" onClick={onSluit} className="btn-secundair flex-1">Annuleren</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Detail ────────────────────────────────────────────────────
function BriefingDetail({ briefing, onVernieuwd, onVerwijder }) {
  const { isManager, isPA, isStaff } = useAuth();
  const [samenwerkingen, setSamenwerkingen] = useState([]);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [fout, setFout] = useState(null);

  const magBewerken = isManager || isPA || isStaff;

  useEffect(() => {
    api.get('/collaborations', { params: { influencer_id: briefing.influencer_id } })
      .then(r => setSamenwerkingen(r.data))
      .catch(() => setSamenwerkingen([]));
  }, [briefing.influencer_id]);

  async function koppel(collaborationId) {
    setBezig(true);
    setFout(null);
    try {
      await api.post(`/briefings/${briefing.id}/koppel`, { collaboration_id: collaborationId || null });
      setMelding(collaborationId ? 'Aan de samenwerking gekoppeld.' : 'Koppeling losgemaakt.');
      onVernieuwd();
    } catch (err) {
      setFout(err.response?.data?.error || 'Koppelen mislukt');
    } finally {
      setBezig(false);
    }
  }

  async function opnieuwUitlezen() {
    setBezig(true);
    setFout(null);
    setMelding(null);
    try {
      const r = await api.post(`/briefings/${briefing.id}/uitlezen`, {}, { timeout: 120000 });
      setMelding(r.data.waarschuwing
        ? `Uitgelezen, met een kanttekening: ${r.data.waarschuwing}`
        : 'Briefing opnieuw uitgelezen.');
      onVernieuwd();
    } catch (err) {
      setFout(err.response?.data?.error || 'Uitlezen mislukt');
    } finally {
      setBezig(false);
    }
  }

  async function vinkAf(deliverable) {
    await api.patch(`/briefings/deliverables/${deliverable.id}`, { afgerond: !deliverable.afgerond });
    onVernieuwd();
  }

  const hashtags     = lijst(briefing.hashtags);
  const vermeldingen = lijst(briefing.vermeldingen);
  const extractie    = briefing.ai_extractie ? JSON.parse(briefing.ai_extractie) : null;
  const status       = aiStatusTekst[briefing.ai_status] || aiStatusTekst.niet_gedraaid;

  return (
    <div className="p-6 space-y-6">
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
      )}
      {melding && (
        <p className="font-sans text-sm text-goud-700 bg-cream-100 border border-cream-300 rounded-editorial px-3 py-2">{melding}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge font-sans ${status.kleur}`}>{status.label}</span>
        {briefing.ai_fout && (
          <span className="font-sans text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle size={12} />{briefing.ai_fout}
          </span>
        )}
      </div>

      {/* Kernvelden */}
      <div className="grid grid-cols-2 gap-4">
        {[
          ['Opdrachtgever', briefing.opdrachtgever],
          ['Influencer', briefing.influencer_naam],
          ['Live', datum(briefing.live_datum)],
          ['Deadline', datum(briefing.deadline)],
          ['Vergoeding', formaatBedrag(briefing.vergoeding)],
          ['Ontvangen', datum(briefing.ontvangen_datum)],
        ].map(([label, waarde]) => (
          <div key={label} className="bg-cream-50 rounded-editorial px-3 py-2">
            <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="font-sans text-sm text-antraciet-800 mt-0.5">{waarde || '—'}</p>
          </div>
        ))}
      </div>

      {briefing.ai_samenvatting && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Samenvatting</p>
          <p className="font-sans text-sm text-antraciet-700 leading-relaxed whitespace-pre-line">
            {briefing.ai_samenvatting}
          </p>
        </div>
      )}

      {/* Deliverables */}
      <div>
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Deliverables</p>
        {briefing.deliverables?.length === 0 ? (
          <p className="font-sans text-sm text-gray-400 italic">Nog geen deliverables uitgelezen.</p>
        ) : (
          <div className="space-y-1">
            {briefing.deliverables.map(d => (
              <button
                key={d.id} onClick={() => vinkAf(d)}
                className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-editorial hover:bg-cream-50 transition-colors"
              >
                {d.afgerond
                  ? <CheckSquare size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
                  : <Square size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  <span className={`block font-sans text-sm ${d.afgerond ? 'text-gray-400 line-through' : 'text-antraciet-800'}`}>
                    {d.omschrijving}
                  </span>
                  {(d.platform || d.deadline) && (
                    <span className="block font-sans text-xs text-gray-400 mt-0.5">
                      {[d.platform, d.deadline && datum(d.deadline)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {(hashtags.length > 0 || vermeldingen.length > 0) && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Hashtags en vermeldingen</p>
          <div className="flex flex-wrap gap-1.5">
            {[...hashtags, ...vermeldingen].map(t => (
              <span key={t} className="badge bg-cream-100 text-antraciet-700 border border-cream-200 font-sans">{t}</span>
            ))}
          </div>
        </div>
      )}

      {briefing.exclusiviteit && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Exclusiviteit</p>
          <p className="font-sans text-sm text-antraciet-700 leading-relaxed">{briefing.exclusiviteit}</p>
        </div>
      )}

      {extractie?.aandachtspunten?.length > 0 && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Aandachtspunten</p>
          <ul className="space-y-1 list-disc pl-4">
            {extractie.aandachtspunten.map((a, i) => (
              <li key={i} className="font-sans text-sm text-antraciet-700 leading-relaxed">{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Koppelen aan een samenwerking */}
      {magBewerken && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Samenwerking</p>
          <select
            className="input text-sm" disabled={bezig}
            value={briefing.samenwerking_id || ''}
            onChange={e => koppel(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Niet gekoppeld</option>
            {samenwerkingen.map(s => (
              <option key={s.id} value={s.id}>{samenwerkingLabel(s)}</option>
            ))}
          </select>
          <p className="font-sans text-xs text-gray-400 mt-1 flex items-start gap-1.5">
            <Link2 size={12} className="flex-shrink-0 mt-0.5" />
            Kan ook achteraf nog. Heeft de samenwerking nog geen livedatum, dan wordt die uit de briefing overgenomen.
          </p>
        </div>
      )}

      {/* Acties */}
      {magBewerken && (
        <div className="space-y-2 pt-2">
          <button
            onClick={opnieuwUitlezen} disabled={bezig}
            className="btn-secundair w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={15} />
            {bezig ? 'Bezig...' : 'Opnieuw uitlezen'}
          </button>
          {briefing.origineel_bestand && (
            <a
              href={briefing.origineel_bestand} target="_blank" rel="noreferrer"
              className="btn-secundair w-full flex items-center justify-center gap-2"
            >
              <FileText size={15} />
              Origineel bestand openen
            </a>
          )}
          <button
            onClick={() => onVerwijder(briefing.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-sans text-red-600 hover:bg-red-50 rounded-editorial transition-colors"
          >
            <Trash2 size={15} />
            Verwijderen
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export default function Briefings() {
  const { isManager, isPA, isStaff } = useAuth();
  const { influencers, actiefId, actief, params } = useInfluencer();

  const [items, setItems]   = useState([]);
  const [laden, setLaden]   = useState(true);
  const [zoekterm, setZoekterm] = useState('');
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const magToevoegen = isManager || isPA || isStaff;

  const laadData = useCallback(async () => {
    setLaden(true);
    try {
      const r = await api.get('/briefings', {
        params: { ...params, ...(zoekterm ? { zoek: zoekterm } : {}) },
      });
      setItems(r.data);
    } finally {
      setLaden(false);
    }
  }, [params, zoekterm]);

  useEffect(() => {
    const t = setTimeout(laadData, 250);
    return () => clearTimeout(t);
  }, [laadData]);

  async function openDetail(id) {
    const r = await api.get(`/briefings/${id}`);
    setGeselecteerd(r.data);
    setDetailOpen(true);
  }

  async function vernieuwDetail() {
    if (!geselecteerd) return;
    const r = await api.get(`/briefings/${geselecteerd.id}`);
    setGeselecteerd(r.data);
    laadData();
  }

  async function verwijder(id) {
    if (!window.confirm('Briefing definitief verwijderen?')) return;
    await api.delete(`/briefings/${id}`);
    setDetailOpen(false);
    laadData();
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-heading text-antraciet-800">Briefings</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            {actief ? actief.naam : 'Alle influencers'} · {items.length} briefing{items.length === 1 ? '' : 's'}
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
              <Upload size={16} />
              Nieuwe briefing
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" className="input pl-9 text-sm max-w-[260px]"
          placeholder="Zoek op titel of opdrachtgever..."
          value={zoekterm} onChange={e => setZoekterm(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        {laden ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="font-sans text-sm">Laden...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <FileText size={40} strokeWidth={1} className="mb-3" />
            <p className="font-serif text-lg">Geen briefings</p>
            <p className="font-sans text-sm mt-1">Upload een PDF of plak de tekst van een briefing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-cream-200">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Briefing</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Influencer</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Live</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Samenwerking</th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Uitlezing</th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-gray-400 uppercase tracking-wider">Vergoeding</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map(b => {
                  const status = aiStatusTekst[b.ai_status] || aiStatusTekst.niet_gedraaid;
                  return (
                    <tr
                      key={b.id} onClick={() => openDetail(b.id)}
                      className="border-b border-cream-200 hover:bg-cream-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-sans text-sm font-medium text-antraciet-800 group-hover:text-goud-600 transition-colors">
                          {b.titel}
                        </p>
                        <p className="font-sans text-xs text-gray-400 mt-0.5">{b.opdrachtgever}</p>
                      </td>
                      <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{b.influencer_naam}</td>
                      <td className="px-4 py-4 font-sans text-sm text-antraciet-700">{datum(b.live_datum)}</td>
                      <td className="px-4 py-4 font-sans text-sm text-gray-500">
                        {b.samenwerking_titel || <span className="text-gray-300">niet gekoppeld</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge font-sans ${status.kleur}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-sans text-sm text-antraciet-800">
                        {formaatBedrag(b.vergoeding)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlideOver
        open={detailOpen}
        onSluit={() => { setDetailOpen(false); setGeselecteerd(null); }}
        titel={geselecteerd?.titel || 'Briefing'}
      >
        {geselecteerd && (
          <BriefingDetail briefing={geselecteerd} onVernieuwd={vernieuwDetail} onVerwijder={verwijder} />
        )}
      </SlideOver>

      <NieuwModal
        open={nieuwOpen}
        onSluit={() => setNieuwOpen(false)}
        onKlaar={b => openDetail(b.id)}
        influencers={influencers}
        actiefId={actiefId}
      />
    </div>
  );
}
