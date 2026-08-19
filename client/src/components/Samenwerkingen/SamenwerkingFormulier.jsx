import React, { useState } from 'react';
import { useInfluencer } from '../../context/InfluencerContext';

const statusOpties = [
  { waarde: 'aanvraag',     label: 'Aanvraag' },
  { waarde: 'bevestigd',    label: 'Bevestigd' },
  { waarde: 'in_productie', label: 'In productie' },
];

export default function SamenwerkingFormulier({ begin = {}, onOpslaan, onAnnuleer }) {
  const { influencers, actiefId } = useInfluencer();
  const [laden, setLaden] = useState(false);
  const [fout, setFout]   = useState(null);
  const [form, setForm]   = useState({
    influencer_id: begin.influencer_id || actiefId || influencers[0]?.id || '',
    klant:         begin.klant || '',
    klant_contact: begin.klant_contact || '',
    klant_email:   begin.klant_email || '',
    klant_adres:   begin.klant_adres || '',
    titel:         begin.titel || '',
    omschrijving:  begin.omschrijving || '',
    bedrag:        begin.bedrag ?? '',
    btw_percentage: begin.btw_percentage ?? 21,
    platform:      begin.platform || '',
    deadline:      begin.deadline || '',
    status:        begin.status || 'aanvraag',
    notities:      begin.notities || '',
  });

  const wijzig = (veld, waarde) => setForm(f => ({ ...f, [veld]: waarde }));

  async function verstuur(e) {
    e.preventDefault();
    setLaden(true);
    setFout(null);
    try {
      await onOpslaan({ ...form, bedrag: parseFloat(form.bedrag || 0) });
    } catch (err) {
      setFout(err.response?.data?.error || 'Opslaan mislukt');
    } finally {
      setLaden(false);
    }
  }

  return (
    <form onSubmit={verstuur} className="space-y-4">
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Influencer *</label>
          <select
            className="input" required
            value={form.influencer_id}
            onChange={e => wijzig('influencer_id', Number(e.target.value))}
            disabled={Boolean(begin.id)}
          >
            <option value="">Kies een influencer</option>
            {influencers.map(i => <option key={i.id} value={i.id}>{i.naam}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Klant / merk *</label>
          <input type="text" className="input" required value={form.klant} onChange={e => wijzig('klant', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Titel *</label>
        <input
          type="text" className="input" required
          placeholder="Bijv. Reel campagne voorjaar"
          value={form.titel} onChange={e => wijzig('titel', e.target.value)}
        />
      </div>

      <div>
        <label className="label">Omschrijving</label>
        <textarea className="input" rows={3} value={form.omschrijving} onChange={e => wijzig('omschrijving', e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Vergoeding excl. BTW</label>
          <input
            type="number" step="0.01" min="0" className="input"
            value={form.bedrag} onChange={e => wijzig('bedrag', e.target.value)}
          />
        </div>
        <div>
          <label className="label">BTW %</label>
          <input
            type="number" step="1" min="0" className="input"
            value={form.btw_percentage} onChange={e => wijzig('btw_percentage', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Platform</label>
          <select className="input" value={form.platform} onChange={e => wijzig('platform', e.target.value)}>
            <option value="">—</option>
            {['instagram', 'tiktok', 'youtube', 'pinterest', 'blog'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Deadline</label>
          <input type="date" className="input" value={form.deadline || ''} onChange={e => wijzig('deadline', e.target.value)} />
        </div>
        {!begin.id && (
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => wijzig('status', e.target.value)}>
              {statusOpties.map(o => <option key={o.waarde} value={o.waarde}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Contactpersoon klant</label>
          <input type="text" className="input" value={form.klant_contact} onChange={e => wijzig('klant_contact', e.target.value)} />
        </div>
        <div>
          <label className="label">E-mail klant</label>
          <input
            type="email" className="input"
            placeholder="Nodig om de factuur te versturen"
            value={form.klant_email} onChange={e => wijzig('klant_email', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Notities</label>
        <textarea className="input" rows={2} value={form.notities} onChange={e => wijzig('notities', e.target.value)} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={laden} className="btn-primair flex-1 disabled:opacity-50">
          {laden ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button type="button" onClick={onAnnuleer} className="btn-secundair flex-1">Annuleren</button>
      </div>
    </form>
  );
}
