const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

// ============================================================
// Briefings uitlezen
// Een PDF of stuk tekst gaat erin, er komt gestructureerde data uit:
// livedatum, deliverables, hashtags, vermeldingen en exclusiviteit.
// Zonder ANTHROPIC_API_KEY valt de module terug op een eenvoudige
// tekstanalyse, zodat het uploaden en invullen altijd blijft werken.
// ============================================================

const MODEL = 'claude-opus-5';

// ── Tekst uit een bestand halen ───────────────────────────────
async function leesTekst(bestandspad, mimetype = '') {
  const extensie = path.extname(bestandspad).toLowerCase();

  if (extensie === '.pdf' || mimetype.includes('pdf')) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fs.readFileSync(bestandspad));
    return data.text;
  }

  if (['.txt', '.md', '.csv'].includes(extensie) || mimetype.startsWith('text/')) {
    return fs.readFileSync(bestandspad, 'utf8');
  }

  throw new Error(`Bestandstype ${extensie || mimetype} kan niet uitgelezen worden. Gebruik een PDF of plak de tekst.`);
}

// ── Schema van wat we uit een briefing willen halen ───────────
const Deliverable = z.object({
  omschrijving: z.string(),
  platform:     z.string().nullable(),
  aantal:       z.number().nullable(),
  deadline:     z.string().nullable(),
});

const BriefingExtractie = z.object({
  samenvatting:  z.string(),
  opdrachtgever: z.string().nullable(),
  titel:         z.string().nullable(),
  live_datum:    z.string().nullable(),
  deadline:      z.string().nullable(),
  vergoeding:    z.number().nullable(),
  deliverables:  z.array(Deliverable),
  hashtags:      z.array(z.string()),
  vermeldingen:  z.array(z.string()),
  exclusiviteit: z.string().nullable(),
  aandachtspunten: z.array(z.string()),
});

const SYSTEEM = `Je leest briefings van merken aan influencers en haalt daar de harde afspraken uit.

Regels:
- Datums altijd als YYYY-MM-DD. Staat er alleen "week 37" of "begin september", laat het veld dan leeg in plaats van te gokken.
- live_datum is de datum waarop de content online moet. deadline is de datum waarop het aangeleverd moet zijn. Zijn die hetzelfde, vul beide.
- vergoeding is het bedrag exclusief btw, als getal zonder valutateken. Onbekend betekent leeg.
- deliverables zijn de concrete op te leveren stukken content, elk apart. "3 stories" is één deliverable met aantal 3.
- hashtags met het #-teken erbij, vermeldingen met het @-teken erbij.
- exclusiviteit: alleen invullen als de briefing er echt iets over zegt, met de exacte strekking en periode. Verzin nooit een concurrentiebeding dat er niet staat.
- aandachtspunten: afspraken die makkelijk misgaan (do's en don'ts, verplichte disclaimers, aanlevertermijn voor goedkeuring).
- Wat er niet in staat, laat je leeg. Nooit aanvullen met wat waarschijnlijk bedoeld wordt.`;

// ── Terugval zonder AI: eenvoudige tekstanalyse ───────────────
function extraheerZonderAI(tekst) {
  const hashtags     = [...new Set((tekst.match(/#[\wÀ-ſ]+/g) || []))];
  // Puntjes mogen middenin een handle staan, maar niet als zinseinde meelopen
  const vermeldingen = [...new Set((tekst.match(/@\w+(?:\.\w+)*/g) || []))];

  // Datums in de vormen 12-09-2026, 12/09/2026 en 2026-09-12
  const datums = [];
  for (const m of tekst.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) datums.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of tekst.matchAll(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g)) {
    datums.push(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  }

  const bedrag = tekst.match(/(?:€|EUR)\s?([\d.]+(?:,\d{2})?)/);

  return {
    samenvatting: tekst.trim().split(/\n\s*\n/)[0]?.slice(0, 400) || '',
    opdrachtgever: null,
    titel: null,
    live_datum: datums[0] || null,
    deadline: datums[1] || datums[0] || null,
    vergoeding: bedrag ? parseFloat(bedrag[1].replace(/\./g, '').replace(',', '.')) : null,
    deliverables: [],
    hashtags,
    vermeldingen,
    exclusiviteit: null,
    aandachtspunten: [],
  };
}

function isGeconfigureerd() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Leest een briefingtekst uit.
 * @returns {Promise<{extractie: object, status: 'klaar'|'handmatig'|'mislukt', fout?: string}>}
 */
async function extraheer(tekst) {
  const schoon = (tekst || '').trim();
  if (!schoon) {
    return { extractie: null, status: 'mislukt', fout: 'De briefing bevat geen tekst om uit te lezen' };
  }

  if (!isGeconfigureerd()) {
    console.log('[briefing] Geen ANTHROPIC_API_KEY — briefing met eenvoudige tekstanalyse uitgelezen');
    return { extractie: extraheerZonderAI(schoon), status: 'handmatig' };
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEEM,
      messages: [{ role: 'user', content: `Lees deze briefing uit:\n\n${schoon}` }],
      output_config: { format: zodOutputFormat(BriefingExtractie) },
    });

    if (response.stop_reason === 'refusal') {
      return { extractie: extraheerZonderAI(schoon), status: 'handmatig', fout: 'Het model heeft de briefing niet verwerkt' };
    }
    if (!response.parsed_output) {
      return { extractie: extraheerZonderAI(schoon), status: 'handmatig', fout: 'De uitlezing kon niet gelezen worden' };
    }

    return { extractie: response.parsed_output, status: 'klaar' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[briefing] Ongeldige ANTHROPIC_API_KEY');
      return { extractie: extraheerZonderAI(schoon), status: 'handmatig', fout: 'De API-sleutel voor de AI is ongeldig' };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { extractie: null, status: 'mislukt', fout: 'De AI is even overbelast, probeer het zo nog eens' };
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[briefing] API-fout:', err.status, err.message);
      return { extractie: null, status: 'mislukt', fout: `AI-fout (${err.status}): ${err.message}` };
    }
    console.error('[briefing] Onverwachte fout:', err.message);
    return { extractie: null, status: 'mislukt', fout: err.message };
  }
}

module.exports = { leesTekst, extraheer, isGeconfigureerd, extraheerZonderAI };
