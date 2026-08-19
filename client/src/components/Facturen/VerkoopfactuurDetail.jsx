import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CheckCircle2, Send, Trash2, Mail, AlertCircle, Unlock } from 'lucide-react';
import api from '../../utils/api';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

function datum(waarde, patroon = 'd MMMM yyyy') {
  if (!waarde) return '—';
  try { return format(parseISO(waarde.replace(' ', 'T')), patroon, { locale: nl }); } catch { return waarde; }
}

function Rij({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-cream-200 last:border-0">
      <span className="font-sans text-xs text-gray-400 uppercase tracking-wider pt-0.5">{label}</span>
      <span className="font-sans text-sm text-antraciet-800 text-right">{children}</span>
    </div>
  );
}

export default function VerkoopfactuurDetail({ factuur, onVernieuwd, onVerwijder }) {
  const [bezig, setBezig]     = useState(false);
  const [fout, setFout]       = useState(null);
  const [melding, setMelding] = useState(null);
  const [email, setEmail]     = useState(factuur.klant_email || '');

  async function actie(fn) {
    setBezig(true);
    setFout(null);
    setMelding(null);
    try {
      await fn();
      onVernieuwd();
    } catch (err) {
      setFout(err.response?.data?.error || 'Actie mislukt');
    } finally {
      setBezig(false);
    }
  }

  const goedkeuren = () => actie(async () => {
    await api.patch(`/sales-invoices/${factuur.id}/goedkeuren`);
    setMelding('Factuur goedgekeurd. Je kunt hem nu naar de klant sturen.');
  });

  const versturen = () => actie(async () => {
    const r = await api.post(`/sales-invoices/${factuur.id}/versturen`, { naar: email });
    setMelding(
      r.data.mail.status === 'verzonden'
        ? `Factuur gemaild naar ${email}. De influencer en de PA hebben bericht gekregen dat zij mogen factureren.`
        : r.data.mail.status === 'niet_geconfigureerd'
          ? `Factuur staat op verzonden en de influencer en PA hebben bericht gekregen. Let op: er is nog geen SMTP ingesteld, dus de mail is niet daadwerkelijk verstuurd.`
          : `Factuur staat op verzonden, maar de mail is mislukt: ${r.data.mail.fout}`
    );
  });

  const vrijgeven = () => actie(async () => {
    await api.post(`/sales-invoices/${factuur.id}/vrijgeven`);
    setMelding('De influencer en de PA hebben bericht gekregen dat zij mogen factureren.');
  });

  const markeerBetaald = (betaald) => actie(() => api.patch(`/sales-invoices/${factuur.id}/betaald`, { betaald }));

  return (
    <div className="space-y-6">
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
      )}
      {melding && (
        <p className="font-sans text-sm text-goud-700 bg-cream-100 border border-cream-300 rounded-editorial px-3 py-2">{melding}</p>
      )}

      {/* ── Bedragen ── */}
      <div className="bg-cream-50 rounded-editorial px-4 py-4">
        <div className="flex justify-between font-sans text-sm text-antraciet-700">
          <span>Bedrag excl. BTW</span><span>{formaatBedrag(factuur.bedrag, factuur.valuta)}</span>
        </div>
        <div className="flex justify-between font-sans text-sm text-gray-500 mt-1">
          <span>BTW {factuur.btw_percentage}%</span><span>{formaatBedrag(factuur.btw_bedrag, factuur.valuta)}</span>
        </div>
        <div className="flex justify-between font-serif text-lg text-antraciet-800 mt-3 pt-3 border-t border-cream-300">
          <span>Totaal</span><span>{formaatBedrag(factuur.totaal, factuur.valuta)}</span>
        </div>
      </div>

      {/* ── Gegevens ── */}
      <div>
        <Rij label="Factuurnummer">{factuur.factuurnummer}</Rij>
        <Rij label="Klant">{factuur.klant}</Rij>
        <Rij label="Influencer">{factuur.influencer_naam}</Rij>
        <Rij label="Samenwerking">{factuur.samenwerking_titel || '—'}</Rij>
        <Rij label="Omschrijving">{factuur.omschrijving}</Rij>
        <Rij label="Factuurdatum">{datum(factuur.factuurdatum)}</Rij>
        <Rij label="Vervaldatum">{datum(factuur.vervaldatum)}</Rij>
        {factuur.goedgekeurd_op && <Rij label="Goedgekeurd">{datum(factuur.goedgekeurd_op, 'd MMM yyyy HH:mm')}</Rij>}
        {factuur.verzonden_op && <Rij label="Verzonden">{datum(factuur.verzonden_op, 'd MMM yyyy HH:mm')}</Rij>}
        {factuur.verzonden_naar && <Rij label="Verstuurd naar">{factuur.verzonden_naar}</Rij>}
        {factuur.betaald_op && <Rij label="Betaald op">{datum(factuur.betaald_op)}</Rij>}
      </div>

      {factuur.automatisch_aangemaakt === 1 && (
        <p className="font-sans text-xs text-gray-400 flex gap-1.5">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          Deze factuur is automatisch klaargezet toen de samenwerking werd afgerond. Controleer hem voordat je hem verstuurt.
        </p>
      )}

      {/* ── Acties ── */}
      <div className="space-y-3">
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider">Acties</p>

        {factuur.status === 'concept' && (
          <button onClick={goedkeuren} disabled={bezig} className="btn-primair w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={15} />
            Goedkeuren
          </button>
        )}

        {['goedgekeurd', 'verzonden'].includes(factuur.status) && (
          <div className="space-y-2">
            <label className="label">E-mailadres klant</label>
            <input
              type="email" className="input" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="factuur@klant.nl"
            />
            <button
              onClick={versturen}
              disabled={bezig || !email}
              className="btn-primair w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={15} />
              {factuur.status === 'verzonden' ? 'Opnieuw versturen naar de klant' : 'Versturen naar de klant'}
            </button>
            <p className="font-sans text-xs text-gray-400">
              Zodra de factuur naar de klant gaat, krijgen de influencer én de PA een melding dat zij hun eigen
              factuur mogen sturen.
            </p>
          </div>
        )}

        {['goedgekeurd', 'verzonden', 'betaald'].includes(factuur.status) && !factuur.influencer_vrijgegeven && (
          <button onClick={vrijgeven} disabled={bezig} className="btn-secundair w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <Unlock size={15} />
            Alleen vrijgeven voor de influencer
          </button>
        )}

        {factuur.status === 'verzonden' && (
          <button onClick={() => markeerBetaald(true)} disabled={bezig} className="btn-secundair w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={15} />
            Markeer als betaald
          </button>
        )}

        {factuur.status === 'betaald' && (
          <button onClick={() => markeerBetaald(false)} disabled={bezig} className="btn-secundair w-full text-sm disabled:opacity-50">
            Betaling terugdraaien
          </button>
        )}

        {factuur.status === 'concept' && (
          <button
            onClick={() => onVerwijder(factuur.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-sans text-red-600 hover:bg-red-50 rounded-editorial transition-colors"
          >
            <Trash2 size={15} />
            Concept verwijderen
          </button>
        )}
      </div>

      {/* ── Factuur van de influencer ── */}
      {factuur.influencer_facturen_lijst?.length > 0 && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Factuur van de influencer</p>
          {factuur.influencer_facturen_lijst.map(f => (
            <div key={f.id} className="bg-cream-50 rounded-editorial px-3 py-2 flex justify-between items-center mb-2">
              <span className="font-sans text-sm text-antraciet-800 flex items-center gap-2">
                <Mail size={13} className="text-gray-400" />
                {f.factuurnummer} · {formaatBedrag(f.totaal, f.valuta)}
              </span>
              <span className="font-sans text-xs text-gray-500 capitalize">{f.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
