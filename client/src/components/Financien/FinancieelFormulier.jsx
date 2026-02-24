import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const TYPEN = [
  { waarde: 'factuur',         label: 'Factuur' },
  { waarde: 'bon',             label: 'Bon / Kassabon' },
  { waarde: 'betaling',        label: 'Betaling' },
  { waarde: 'salarisoverzicht',label: 'Salarisoverzicht' },
];

export default function FinancieelFormulier({ onOpslaan, onAnnuleer, beginWaarden }) {
  const [influencers, setInfluencers] = useState([]);
  const [categorieën, setCategorieën] = useState([]);
  const [bestand, setBestand] = useState(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState('');

  const [form, setForm] = useState({
    influencer_id: '',
    categorie_id: '',
    type: 'factuur',
    omschrijving: '',
    bedrag: '',
    btw_bedrag: '',
    valuta: 'EUR',
    datum: new Date().toISOString().split('T')[0],
    betaald: false,
    betaald_datum: '',
    opdrachtgever: '',
    notities: '',
    ...beginWaarden,
  });

  useEffect(() => {
    Promise.all([
      api.get('/influencers'),
      api.get('/finance/categorieen'),
    ]).then(([inf, cat]) => {
      setInfluencers(inf.data);
      setCategorieën(cat.data);
    });
  }, []);

  function wijzig(veld, waarde) {
    setForm(v => ({ ...v, [veld]: waarde }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFout('');
    setLaden(true);
    try {
      const nieuwItem = await onOpslaan(form);
      // Bestand uploaden als geselecteerd
      if (bestand && nieuwItem?.id) {
        const fd = new FormData();
        fd.append('bestand', bestand);
        await api.post(`/finance/${nieuwItem.id}/bestand`, fd);
      }
    } catch (err) {
      setFout(err.response?.data?.error || 'Er is een fout opgetreden');
    } finally {
      setLaden(false);
    }
  }

  const inkomsteCategorieën = categorieën.filter(c => c.type === 'inkomsten');
  const uitgavenCategorieën = categorieën.filter(c => c.type === 'uitgaven');

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Influencer */}
      <div>
        <label className="label">Influencer *</label>
        <select className="input" value={form.influencer_id} onChange={e => wijzig('influencer_id', e.target.value)} required>
          <option value="">Selecteer influencer...</option>
          {influencers.map(i => <option key={i.id} value={i.id}>{i.naam}</option>)}
        </select>
      </div>

      {/* Type + Datum */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.type} onChange={e => wijzig('type', e.target.value)} required>
            {TYPEN.map(t => <option key={t.waarde} value={t.waarde}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Datum *</label>
          <input type="date" className="input" value={form.datum} onChange={e => wijzig('datum', e.target.value)} required />
        </div>
      </div>

      {/* Omschrijving */}
      <div>
        <label className="label">Omschrijving *</label>
        <input
          type="text" className="input" value={form.omschrijving}
          onChange={e => wijzig('omschrijving', e.target.value)}
          placeholder="bijv. Samenwerking zomercollectie 2025"
          required
        />
      </div>

      {/* Opdrachtgever */}
      <div>
        <label className="label">Opdrachtgever / Merk</label>
        <input
          type="text" className="input" value={form.opdrachtgever}
          onChange={e => wijzig('opdrachtgever', e.target.value)}
          placeholder="bijv. Zara, H&M"
        />
      </div>

      {/* Bedrag + BTW */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Bedrag (€) *</label>
          <input
            type="number" step="0.01" min="0" className="input"
            value={form.bedrag} onChange={e => wijzig('bedrag', e.target.value)}
            placeholder="0,00" required
          />
        </div>
        <div>
          <label className="label">BTW (€)</label>
          <input
            type="number" step="0.01" min="0" className="input"
            value={form.btw_bedrag} onChange={e => wijzig('btw_bedrag', e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Categorie */}
      <div>
        <label className="label">Categorie</label>
        <select className="input" value={form.categorie_id} onChange={e => wijzig('categorie_id', e.target.value)}>
          <option value="">Geen categorie</option>
          {inkomsteCategorieën.length > 0 && (
            <optgroup label="Inkomsten">
              {inkomsteCategorieën.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
            </optgroup>
          )}
          {uitgavenCategorieën.length > 0 && (
            <optgroup label="Uitgaven">
              {uitgavenCategorieën.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {/* Betaald */}
      <div className="bg-cream-50 rounded-editorial p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox" checked={form.betaald}
            onChange={e => wijzig('betaald', e.target.checked)}
            className="w-4 h-4 accent-goud-500"
          />
          <span className="font-sans text-sm font-medium text-antraciet-800">Reeds betaald / ontvangen</span>
        </label>
        {form.betaald && (
          <div>
            <label className="label">Betaald op</label>
            <input type="date" className="input" value={form.betaald_datum} onChange={e => wijzig('betaald_datum', e.target.value)} />
          </div>
        )}
      </div>

      {/* Bestand uploaden */}
      <div>
        <label className="label">Bijlage (factuur / bon)</label>
        <input
          type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-editorial file:border-0 file:bg-cream-200 file:text-antraciet-700 file:text-xs file:font-medium hover:file:bg-cream-300 cursor-pointer"
          onChange={e => setBestand(e.target.files[0] || null)}
        />
        <p className="text-xs text-gray-400 mt-1">PDF, JPG of PNG — max 20 MB</p>
      </div>

      {/* Notities */}
      <div>
        <label className="label">Notities</label>
        <textarea className="input resize-none" rows={2} value={form.notities} onChange={e => wijzig('notities', e.target.value)} placeholder="Interne notities..." />
      </div>

      {fout && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{fout}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={laden} className="btn-primair flex-1 disabled:opacity-50">
          {laden ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button type="button" onClick={onAnnuleer} className="btn-secundair flex-1">Annuleren</button>
      </div>
    </form>
  );
}
