import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const vervoerders = ['DHL', 'PostNL', 'UPS', 'FedEx', 'DPD', 'GLS', 'Anders'];

export default function PakketFormulier({ onOpslaan, onAnnuleer, beginWaarden }) {
  const [influencers, setInfluencers] = useState([]);
  const [form, setForm] = useState({
    influencer_id: '',
    merk: '',
    omschrijving: '',
    tracking_nummer: '',
    vervoerder: '',
    verwachte_datum: '',
    retour_vereist: false,
    retour_deadline: '',
    notities: '',
    ...beginWaarden,
  });
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState('');

  useEffect(() => {
    api.get('/influencers').then(r => setInfluencers(r.data));
  }, []);

  function wijzig(veld, waarde) {
    setForm(v => ({ ...v, [veld]: waarde }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFout('');
    setLaden(true);
    try {
      await onOpslaan(form);
    } catch (err) {
      setFout(err.response?.data?.error || 'Er is een fout opgetreden');
    } finally {
      setLaden(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Influencer */}
      <div>
        <label className="label">Influencer *</label>
        <select
          className="input"
          value={form.influencer_id}
          onChange={e => wijzig('influencer_id', e.target.value)}
          required
        >
          <option value="">Selecteer influencer...</option>
          {influencers.map(i => (
            <option key={i.id} value={i.id}>{i.naam} {i.gebruikersnaam ? `(${i.gebruikersnaam})` : ''}</option>
          ))}
        </select>
      </div>

      {/* Merk */}
      <div>
        <label className="label">Merk *</label>
        <input
          type="text"
          className="input"
          value={form.merk}
          onChange={e => wijzig('merk', e.target.value)}
          placeholder="bijv. Jacquemus, Chanel, Zara"
          required
        />
      </div>

      {/* Omschrijving */}
      <div>
        <label className="label">Omschrijving</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.omschrijving}
          onChange={e => wijzig('omschrijving', e.target.value)}
          placeholder="Inhoud van het pakket..."
        />
      </div>

      {/* Tracking */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Trackingnummer</label>
          <input
            type="text"
            className="input"
            value={form.tracking_nummer}
            onChange={e => wijzig('tracking_nummer', e.target.value)}
            placeholder="JQ20250224001"
          />
        </div>
        <div>
          <label className="label">Vervoerder</label>
          <select
            className="input"
            value={form.vervoerder}
            onChange={e => wijzig('vervoerder', e.target.value)}
          >
            <option value="">Selecteer...</option>
            {vervoerders.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Verwachte datum */}
      <div>
        <label className="label">Verwachte leverdatum</label>
        <input
          type="date"
          className="input"
          value={form.verwachte_datum}
          onChange={e => wijzig('verwachte_datum', e.target.value)}
        />
      </div>

      {/* Retour */}
      <div className="bg-cream-50 rounded-editorial p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.retour_vereist}
            onChange={e => wijzig('retour_vereist', e.target.checked)}
            className="w-4 h-4 accent-goud-500"
          />
          <span className="font-sans text-sm font-medium text-antraciet-800">Retour vereist</span>
        </label>

        {form.retour_vereist && (
          <div>
            <label className="label">Retourdeadline</label>
            <input
              type="date"
              className="input"
              value={form.retour_deadline}
              onChange={e => wijzig('retour_deadline', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Notities */}
      <div>
        <label className="label">Notities</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.notities}
          onChange={e => wijzig('notities', e.target.value)}
          placeholder="Interne notities..."
        />
      </div>

      {fout && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{fout}</p>
      )}

      {/* Knoppen */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={laden} className="btn-primair flex-1 disabled:opacity-50">
          {laden ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button type="button" onClick={onAnnuleer} className="btn-secundair flex-1">
          Annuleren
        </button>
      </div>
    </form>
  );
}
