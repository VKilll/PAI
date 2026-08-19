import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Trash2, Receipt, ArrowRight, AlertCircle, FileText } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { briefingLabel } from '../../utils/labels';

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

function datum(waarde, patroon = 'd MMMM yyyy') {
  if (!waarde) return '—';
  try { return format(parseISO(waarde), patroon, { locale: nl }); } catch { return waarde; }
}

// Volgende logische stap in de doorloop
const volgendeStap = {
  aanvraag:     { status: 'bevestigd',    label: 'Bevestigen' },
  bevestigd:    { status: 'in_productie', label: 'In productie' },
  in_productie: { status: 'gepost',       label: 'Markeer als gepost' },
};

function Rij({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-cream-200 last:border-0">
      <span className="font-sans text-xs text-gray-400 uppercase tracking-wider pt-0.5">{label}</span>
      <span className="font-sans text-sm text-antraciet-800 text-right">{children}</span>
    </div>
  );
}

export default function SamenwerkingDetail({ samenwerking, onVernieuwd, onVerwijder }) {
  const { isPA, isManager, isStaff } = useAuth();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout]   = useState(null);
  const [melding, setMelding] = useState(null);

  const magBewerken = isPA || isManager || isStaff;
  const stap = volgendeStap[samenwerking.status];

  // Briefings van dezelfde influencer, om er achteraf nog een aan te hangen
  const [briefings, setBriefings] = useState([]);
  useEffect(() => {
    if (!magBewerken) return;
    api.get('/briefings', { params: { influencer_id: samenwerking.influencer_id } })
      .then(r => setBriefings(r.data))
      .catch(() => setBriefings([]));
  }, [samenwerking.influencer_id, magBewerken]);

  async function koppelBriefing(briefingId) {
    setBezig(true);
    setFout(null);
    try {
      if (briefingId) {
        await api.post(`/briefings/${briefingId}/koppel`, { collaboration_id: samenwerking.id });
      } else if (samenwerking.briefing_id) {
        await api.post(`/briefings/${samenwerking.briefing_id}/koppel`, { collaboration_id: null });
      }
      onVernieuwd();
    } catch (err) {
      setFout(err.response?.data?.error || 'Koppelen mislukt');
    } finally {
      setBezig(false);
    }
  }

  async function wijzigStatus(status) {
    setBezig(true);
    setFout(null);
    try {
      const r = await api.patch(`/collaborations/${samenwerking.id}/status`, { status });
      if (r.data.verkoopfactuur) {
        setMelding(
          `Samenwerking afgerond. Verkoopfactuur ${r.data.verkoopfactuur.factuurnummer} staat als concept klaar voor de manager.`
        );
      }
      onVernieuwd();
    } catch (err) {
      setFout(err.response?.data?.error || 'Wijzigen mislukt');
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-6">
      {fout && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-100 rounded-editorial px-3 py-2">{fout}</p>
      )}
      {melding && (
        <p className="font-sans text-sm text-goud-700 bg-cream-100 border border-cream-300 rounded-editorial px-3 py-2 flex gap-2">
          <Receipt size={15} className="flex-shrink-0 mt-0.5" />
          {melding}
        </p>
      )}

      {/* ── Kern ── */}
      <div>
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Samenwerking</p>
        <Rij label="Klant">{samenwerking.klant}</Rij>
        <Rij label="Influencer">{samenwerking.influencer_naam}</Rij>
        <Rij label="Platform">{samenwerking.platform || '—'}</Rij>
        <Rij label="Vergoeding">
          {formaatBedrag(samenwerking.bedrag, samenwerking.valuta)}
          <span className="text-gray-400"> excl. {samenwerking.btw_percentage}% BTW</span>
        </Rij>
        <Rij label="Deadline">{datum(samenwerking.deadline)}</Rij>
        <Rij label="Gepost op">{datum(samenwerking.post_datum)}</Rij>
      </div>

      {samenwerking.omschrijving && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Omschrijving</p>
          <p className="font-sans text-sm text-antraciet-700 leading-relaxed whitespace-pre-line">
            {samenwerking.omschrijving}
          </p>
        </div>
      )}

      {/* ── Facturatie ── */}
      <div>
        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Facturatie</p>
        {samenwerking.verkoopfactuur_nummer ? (
          <>
            <Rij label="Verkoopfactuur">{samenwerking.verkoopfactuur_nummer}</Rij>
            <Rij label="Status factuur">{samenwerking.verkoopfactuur_status}</Rij>
            <Rij label="Vrijgegeven">
              {samenwerking.influencer_vrijgegeven
                ? <span className="text-green-700">Ja — influencer mag factureren</span>
                : <span className="text-gray-400">Nog niet, manager moet eerst versturen</span>}
            </Rij>
          </>
        ) : (
          <p className="font-sans text-sm text-gray-400 italic">
            Nog geen factuur. Die wordt automatisch klaargezet zodra de samenwerking gepost is.
          </p>
        )}

        {samenwerking.influencer_facturen?.length > 0 && (
          <div className="mt-3 space-y-2">
            {samenwerking.influencer_facturen.map(f => (
              <div key={f.id} className="bg-cream-50 rounded-editorial px-3 py-2 flex justify-between">
                <span className="font-sans text-sm text-antraciet-800">Factuur influencer {f.factuurnummer}</span>
                <span className="font-sans text-xs text-gray-500 capitalize">{f.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Briefing ── */}
      {magBewerken && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Briefing</p>
          <select
            className="input text-sm" disabled={bezig}
            value={samenwerking.briefing_id || ''}
            onChange={e => koppelBriefing(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Geen briefing gekoppeld</option>
            {briefings.map(b => (
              <option key={b.id} value={b.id}>{briefingLabel(b)}</option>
            ))}
          </select>
          <p className="font-sans text-xs text-gray-400 mt-1 flex items-start gap-1.5">
            <FileText size={12} className="flex-shrink-0 mt-0.5" />
            {briefings.length === 0
              ? 'Deze influencer heeft nog geen briefings. Voeg er een toe onder Briefings.'
              : 'Ook achteraf nog te koppelen. De livedatum uit de briefing wordt overgenomen als die hier nog leeg is.'}
          </p>
        </div>
      )}

      {/* ── Doorloop ── */}
      {magBewerken && !samenwerking.gearchiveerd && (
        <div className="space-y-2">
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider">Volgende stap</p>
          {stap && (
            <button
              onClick={() => wijzigStatus(stap.status)}
              disabled={bezig}
              className="btn-primair w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {stap.label}
              <ArrowRight size={15} />
            </button>
          )}
          <button
            onClick={() => wijzigStatus('geannuleerd')}
            disabled={bezig}
            className="btn-secundair w-full text-sm disabled:opacity-50"
          >
            Annuleren
          </button>
          {samenwerking.status === 'in_productie' && (
            <p className="font-sans text-xs text-gray-400 flex gap-1.5">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              Zodra je op gepost zet, gaat de samenwerking naar het archief en krijgt de manager een melding om de
              verkoopfactuur te versturen.
            </p>
          )}
        </div>
      )}

      {/* ── Historie ── */}
      {samenwerking.historie?.length > 0 && (
        <div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-2">Historie</p>
          <div className="space-y-2">
            {samenwerking.historie.map(h => (
              <div key={h.id} className="flex gap-3 text-sm">
                <span className="font-sans text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">
                  {datum(h.aangemaakt, 'd MMM HH:mm')}
                </span>
                <span className="font-sans text-antraciet-700">
                  {h.van_status} → <span className="font-medium">{h.naar_status}</span>
                  {h.gebruiker_naam && <span className="text-gray-400"> · {h.gebruiker_naam}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(isPA || isManager) && !samenwerking.verkoopfactuur_nummer && (
        <button
          onClick={() => onVerwijder(samenwerking.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-sans text-red-600 hover:bg-red-50 rounded-editorial transition-colors"
        >
          <Trash2 size={15} />
          Verwijderen
        </button>
      )}
    </div>
  );
}
