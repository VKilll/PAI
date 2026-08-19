import React, { useEffect, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import api from '../../utils/api';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

// De titel bevat de klantnaam vaak al; die dan niet nog eens ervoor zetten
function omschrijf(samenwerking) {
  const { titel, klant } = samenwerking;
  return titel.toLowerCase().includes(klant.toLowerCase()) ? titel : `${klant} — ${titel}`;
}

export default function InfluencerFactuurFormulier({ influencerId, voorgeselecteerd, onOpslaan, onAnnuleer }) {
  const [samenwerkingen, setSamenwerkingen] = useState([]);
  const [ontvanger, setOntvanger] = useState({ ontvanger: 'Scala Management', ontvanger_email: '' });
  const [ladenLijst, setLadenLijst] = useState(true);
  const [laden, setLaden] = useState(false);
  const [fout, setFout]   = useState(null);
  const [form, setForm]   = useState({
    collaboration_id: voorgeselecteerd || '',
    omschrijving: '',
    bedrag: '',
    btw_percentage: 21,
    factuurdatum: new Date().toISOString().split('T')[0],
  });

  // Alleen samenwerkingen die de manager al aan de klant heeft gefactureerd
  useEffect(() => {
    setLadenLijst(true);
    Promise.all([
      api.get('/collaborations/factureerbaar', { params: influencerId ? { influencer_id: influencerId } : {} }),
      api.get('/influencer-invoices/ontvanger'),
    ])
      .then(([lijst, ont]) => {
        setSamenwerkingen(lijst.data);
        setOntvanger(ont.data);
      })
      .catch(() => setSamenwerkingen([]))
      .finally(() => setLadenLijst(false));
  }, [influencerId]);

  // Bedrag en omschrijving overnemen van de gekozen samenwerking
  useEffect(() => {
    const gekozen = samenwerkingen.find(s => String(s.id) === String(form.collaboration_id));
    if (!gekozen) return;
    setForm(f => ({
      ...f,
      omschrijving: f.omschrijving || omschrijf(gekozen),
      bedrag: f.bedrag === '' ? gekozen.bedrag : f.bedrag,
      btw_percentage: gekozen.btw_percentage ?? f.btw_percentage,
    }));
  }, [form.collaboration_id, samenwerkingen]);

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

  if (ladenLijst) {
    return <p className="font-sans text-sm text-gray-400 py-6 text-center">Samenwerkingen laden...</p>;
  }

  if (samenwerkingen.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 bg-cream-50 border border-cream-200 rounded-editorial px-4 py-4">
          <Lock size={18} className="text-goud-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-antraciet-800">Nog niets om te factureren</p>
            <p className="font-sans text-sm text-gray-500 mt-1 leading-relaxed">
              Je kunt pas een factuur maken voor een samenwerking die de manager al aan de klant heeft gefactureerd.
              Zodra dat gebeurt krijg je vanzelf een melding en verschijnt de samenwerking hier.
            </p>
          </div>
        </div>
        <button type="button" onClick={onAnnuleer} className="btn-secundair w-full">Sluiten</button>
      </div>
    );
  }

  const gekozen = samenwerkingen.find(s => String(s.id) === String(form.collaboration_id));

  return (
    <form onSubmit={verstuur} className="space-y-4">
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
      )}

      <p className="font-sans text-xs text-gray-500 flex gap-2 bg-cream-50 rounded-editorial px-3 py-2">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-goud-500" />
        Deze factuur gaat naar <span className="font-medium text-antraciet-800">{ontvanger.ontvanger}</span>
        {ontvanger.ontvanger_email ? ` (${ontvanger.ontvanger_email})` : ''}.
      </p>

      <div>
        <label className="label">Samenwerking *</label>
        <select
          className="input" required
          value={form.collaboration_id}
          onChange={e => wijzig('collaboration_id', e.target.value)}
        >
          <option value="">Kies een gefactureerde samenwerking</option>
          {samenwerkingen.map(s => (
            <option key={s.id} value={s.id}>
              {omschrijf(s)} ({formaatBedrag(s.bedrag, s.valuta)})
            </option>
          ))}
        </select>
        <p className="font-sans text-xs text-gray-400 mt-1">
          Alleen samenwerkingen die de manager al heeft gefactureerd en vrijgegeven.
        </p>
      </div>

      {gekozen && (
        <div className="bg-cream-50 rounded-editorial px-4 py-3 font-sans text-xs text-gray-500 space-y-1">
          <p>Influencer: <span className="text-antraciet-800">{gekozen.influencer_naam}</span></p>
          <p>Verkoopfactuur manager: <span className="text-antraciet-800">{gekozen.verkoopfactuur_nummer}</span></p>
        </div>
      )}

      <div>
        <label className="label">Omschrijving *</label>
        <input
          type="text" className="input" required
          value={form.omschrijving} onChange={e => wijzig('omschrijving', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Bedrag excl. BTW *</label>
          <input
            type="number" step="0.01" min="0" className="input" required
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
          <label className="label">Factuurdatum</label>
          <input
            type="date" className="input"
            value={form.factuurdatum} onChange={e => wijzig('factuurdatum', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-between font-serif text-lg text-antraciet-800 bg-cream-50 rounded-editorial px-4 py-3">
        <span>Totaal incl. BTW</span>
        <span>
          {formaatBedrag(
            (parseFloat(form.bedrag || 0)) * (1 + (parseFloat(form.btw_percentage || 0) / 100))
          )}
        </span>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={laden} className="btn-primair flex-1 disabled:opacity-50">
          {laden ? 'Opslaan...' : 'Concept opslaan'}
        </button>
        <button type="button" onClick={onAnnuleer} className="btn-secundair flex-1">Annuleren</button>
      </div>
    </form>
  );
}
