const { getDb } = require('../database/db');

// ============================================================
// Vandaag
//
// Agenda-items worden AFGELEID uit de echte records: een samenwerking die
// live moet, een geplande post, een retourdeadline, een factuur die
// vervalt. Er is dus geen losse takenlijst die kan gaan afwijken, en een
// item hangt altijd aan precies één influencer.
//
// Wat verstreken is verdwijnt niet: het schuift op naar "achterstallig"
// tot iemand zegt of het gebeurd is.
//
// Eén record levert hooguit ÉÉN regel op. Een samenwerking heeft vaak zowel
// een aanleverdeadline als een livedatum; zou je die allebei tonen, dan staat
// hetzelfde merk twee keer op dezelfde dag, of tegelijk bij "achterstallig"
// én bij "komend". Daarom tonen we steeds alleen het eerstvolgende dat moet
// gebeuren, en pas als dat is afgehandeld schuift de volgende stap door.
// ============================================================

function vandaag() {
  return new Date().toISOString().split('T')[0];
}

/** Sleutel waarmee een beslissing aan een afgeleid item hangt. */
function sleutel(item) {
  return `${item.bron_type}:${item.bron_id}:${item.soort}`;
}

/** Vallen twee regels op dezelfde dag, dan wint het echte moment. */
const SOORT_VOORRANG = { live: 0, plaatsen: 0, retour: 0, versturen: 0, vervalt: 0, deadline: 1 };

function voorrang(item) {
  return SOORT_VOORRANG[item.soort] ?? 0;
}

/**
 * Kiest per record de ene regel die er nu toe doet: het eerstvolgende punt
 * vanaf vandaag, en als alles al verstreken is het meest recente gemiste punt.
 */
function eerstvolgende(kandidaten, vandaagDatum) {
  const komend = kandidaten
    .filter(k => k.datum >= vandaagDatum)
    .sort((a, b) => a.datum.localeCompare(b.datum) || voorrang(a) - voorrang(b));
  if (komend.length > 0) return komend[0];

  return [...kandidaten]
    .sort((a, b) => b.datum.localeCompare(a.datum) || voorrang(a) - voorrang(b))[0];
}

// ── De bronnen ────────────────────────────────────────────────
// Elke bron levert items met: bron_type, bron_id, soort, datum, titel,
// toelichting, influencer_id, influencer_naam, link.

function samenwerkingItems(db, waar, params) {
  const rijen = db.prepare(`
    SELECT c.*, i.naam AS influencer_naam
    FROM collaborations c
    JOIN influencers i ON c.influencer_id = i.id
    WHERE c.status NOT IN ('geannuleerd', 'afgerond') ${waar}
  `).all(...params);

  const items = [];
  for (const c of rijen) {
    // Een samenwerking die vandaag live moet
    if (c.post_datum && c.status !== 'gepost') {
      items.push({
        bron_type: 'collaboration', bron_id: c.id, soort: 'live',
        datum: c.post_datum,
        titel: `${c.klant} live`,
        toelichting: c.titel,
        influencer_id: c.influencer_id, influencer_naam: c.influencer_naam,
        link: `/samenwerkingen?item=${c.id}`,
        actie: 'gepost',
      });
    }
    // Aanleverdeadline
    if (c.deadline && !['gepost'].includes(c.status)) {
      items.push({
        bron_type: 'collaboration', bron_id: c.id, soort: 'deadline',
        datum: c.deadline,
        titel: `Deadline ${c.klant}`,
        toelichting: c.titel,
        influencer_id: c.influencer_id, influencer_naam: c.influencer_naam,
        link: `/samenwerkingen?item=${c.id}`,
      });
    }
  }
  return items;
}

function contentItems(db, waar, params) {
  return db.prepare(`
    SELECT p.*, i.naam AS influencer_naam, pl.naam AS platform_naam
    FROM content_posts p
    JOIN influencers i ON p.influencer_id = i.id
    LEFT JOIN content_platforms pl ON p.platform_id = pl.id
    WHERE p.status NOT IN ('gepost', 'geverifieerd') ${waar}
  `).all(...params).map(p => ({
    bron_type: 'content_post', bron_id: p.id, soort: 'plaatsen',
    datum: p.geplande_datum,
    titel: p.titel || 'Post plaatsen',
    toelichting: [p.platform_naam, p.type].filter(Boolean).join(' · '),
    influencer_id: p.influencer_id, influencer_naam: p.influencer_naam,
    link: `/content?post=${p.id}`,
    actie: 'gepost',
  }));
}

function pakketItems(db, waar, params) {
  return db.prepare(`
    SELECT pk.*, i.naam AS influencer_naam
    FROM packages pk
    JOIN influencers i ON pk.influencer_id = i.id
    WHERE pk.retour_vereist = 1
      AND pk.retour_deadline IS NOT NULL
      AND pk.status NOT IN ('geretourneerd', 'afgerond') ${waar}
  `).all(...params).map(pk => ({
    bron_type: 'package', bron_id: pk.id, soort: 'retour',
    datum: pk.retour_deadline,
    titel: `Retour ${pk.merk}`,
    toelichting: pk.omschrijving,
    influencer_id: pk.influencer_id, influencer_naam: pk.influencer_naam,
    link: `/pakketten?pakket=${pk.id}`,
  }));
}

function factuurItems(db, waar, params, rol) {
  const items = [];

  // Verkoopfacturen zijn van de manager
  if (rol === 'manager') {
    for (const f of db.prepare(`
      SELECT s.*, i.naam AS influencer_naam
      FROM sales_invoices s
      JOIN influencers i ON s.influencer_id = i.id
      WHERE s.status IN ('concept', 'goedgekeurd', 'verzonden') ${waar}
    `).all(...params)) {
      items.push({
        bron_type: 'sales_invoice', bron_id: f.id,
        soort: f.status === 'verzonden' ? 'vervalt' : 'versturen',
        datum: f.status === 'verzonden' ? f.vervaldatum : f.factuurdatum,
        titel: f.status === 'verzonden' ? `Betaling ${f.klant}` : `Factuur ${f.klant} versturen`,
        toelichting: `${f.factuurnummer} · ${f.omschrijving}`,
        influencer_id: f.influencer_id, influencer_naam: f.influencer_naam,
        link: `/verkoopfacturen?factuur=${f.id}`,
      });
    }
  }

  return items.filter(i => i.datum);
}

/**
 * Bouwt de complete agenda voor deze gebruiker.
 * @returns {{vandaag: object[], achterstallig: object[], komend: object[]}}
 */
function bouwAgenda(db, { influencerIds = null, influencerId = null, rol, dagenVooruit = 7 }) {
  const filters = [];
  const params = [];

  if (influencerId) { filters.push('influencer_id = ?'); params.push(influencerId); }
  if (influencerIds !== null) {
    if (influencerIds.length === 0) return { vandaag: [], achterstallig: [], komend: [] };
    filters.push(`influencer_id IN (${influencerIds.map(() => '?').join(',')})`);
    params.push(...influencerIds);
  }

  const maak = (alias) => filters.length
    ? ' AND ' + filters.map(f => `${alias}.${f}`).join(' AND ')
    : '';

  const alles = [
    ...samenwerkingItems(db, maak('c'), params),
    ...contentItems(db, maak('p'), params),
    ...pakketItems(db, maak('pk'), params),
    ...factuurItems(db, maak('s'), params, rol),
  ].filter(i => i.datum);

  // Beslissingen erbij zoeken: afgehandeld verdwijnt, verschoven krijgt een nieuwe datum
  const beslissingen = new Map(
    db.prepare(`SELECT * FROM agenda_beslissingen`).all()
      .map(b => [`${b.bron_type}:${b.bron_id}:${b.soort}`, b])
  );

  const vandaagDatum = vandaag();
  const grens = new Date(Date.now() + dagenVooruit * 86400000).toISOString().split('T')[0];

  const open = [];
  for (const item of alles) {
    const beslissing = beslissingen.get(sleutel(item));
    if (beslissing && ['gedaan', 'vervallen'].includes(beslissing.beslissing)) continue;
    if (beslissing?.beslissing === 'verschoven' && beslissing.nieuwe_datum) {
      item.datum = beslissing.nieuwe_datum;
      item.verschoven = true;
    }
    open.push(item);
  }

  // Per record één regel overhouden, zodat hetzelfde merk niet twee keer
  // op een dag staat of in twee bakken tegelijk opduikt
  const perRecord = new Map();
  for (const item of open) {
    const groep = `${item.bron_type}:${item.bron_id}`;
    if (!perRecord.has(groep)) perRecord.set(groep, []);
    perRecord.get(groep).push(item);
  }
  const enkelvoudig = [...perRecord.values()].map(k => eerstvolgende(k, vandaagDatum));

  const sorteer = (a, b) => a.datum.localeCompare(b.datum) || a.titel.localeCompare(b.titel);

  return {
    datum: vandaagDatum,
    achterstallig: enkelvoudig.filter(i => i.datum <  vandaagDatum).sort(sorteer),
    vandaag:       enkelvoudig.filter(i => i.datum === vandaagDatum).sort(sorteer),
    komend:        enkelvoudig.filter(i => i.datum >  vandaagDatum && i.datum <= grens).sort(sorteer),
  };
}

module.exports = { bouwAgenda, vandaag, sleutel, eerstvolgende };
