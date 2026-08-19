const { getDb } = require('../database/db');

// ============================================================
// Factuurnummers en het automatisch aanmaken van verkoopfacturen
// ============================================================

const BETAALTERMIJN_DAGEN = parseInt(process.env.BETAALTERMIJN_DAGEN || '30', 10);

function berekenBtw(bedrag, percentage) {
  const excl  = Math.round((parseFloat(bedrag) || 0) * 100) / 100;
  const btw   = Math.round(excl * ((parseFloat(percentage) || 0) / 100) * 100) / 100;
  return { bedrag: excl, btw_bedrag: btw, totaal: Math.round((excl + btw) * 100) / 100 };
}

function vervaldatum(vanaf, dagen = BETAALTERMIJN_DAGEN) {
  const d = new Date(`${vanaf}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().split('T')[0];
}

/**
 * Eerstvolgende vrije verkoopfactuurnummer binnen het jaar: 2026-0001, 2026-0002, ...
 */
function volgendVerkoopfactuurnummer(db = getDb(), jaar = new Date().getFullYear()) {
  const bestaand = db.prepare(
    `SELECT factuurnummer FROM sales_invoices WHERE factuurnummer LIKE ?`
  ).all(`${jaar}-%`);

  const hoogste = bestaand.reduce((max, r) => {
    const n = parseInt(String(r.factuurnummer).split('-')[1], 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);

  return `${jaar}-${String(hoogste + 1).padStart(4, '0')}`;
}

/**
 * Maakt automatisch een CONCEPT-verkoopfactuur bij een afgeronde samenwerking.
 * De manager controleert en verstuurt hem daarna zelf — er gaat dus niets
 * buiten de deur zonder akkoord.
 * Idempotent: bestaat er al een factuur voor de samenwerking, dan die.
 */
function maakConceptVerkoopfactuur(samenwerking, userId = null, db = getDb()) {
  if (samenwerking.sales_invoice_id) {
    const bestaand = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(samenwerking.sales_invoice_id);
    if (bestaand) return { factuur: bestaand, nieuw: false };
  }

  const datum = new Date().toISOString().split('T')[0];
  const { bedrag, btw_bedrag, totaal } = berekenBtw(samenwerking.bedrag, samenwerking.btw_percentage);

  const result = db.prepare(`
    INSERT INTO sales_invoices
      (factuurnummer, collaboration_id, influencer_id, klant, klant_contact, klant_email, klant_adres,
       omschrijving, bedrag, btw_percentage, btw_bedrag, totaal, valuta,
       factuurdatum, vervaldatum, status, automatisch_aangemaakt, aangemaakt_door)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concept', 1, ?)
  `).run(
    volgendVerkoopfactuurnummer(db),
    samenwerking.id,
    samenwerking.influencer_id,
    samenwerking.klant,
    samenwerking.klant_contact || null,
    samenwerking.klant_email || null,
    samenwerking.klant_adres || null,
    samenwerking.titel,
    bedrag,
    samenwerking.btw_percentage ?? 21,
    btw_bedrag,
    totaal,
    samenwerking.valuta || 'EUR',
    datum,
    vervaldatum(datum),
    userId
  );

  const factuur = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(result.lastInsertRowid);

  db.prepare(`UPDATE collaborations SET sales_invoice_id = ?, bijgewerkt = datetime('now') WHERE id = ?`)
    .run(factuur.id, samenwerking.id);

  return { factuur, nieuw: true };
}

module.exports = {
  berekenBtw,
  vervaldatum,
  volgendVerkoopfactuurnummer,
  maakConceptVerkoopfactuur,
  BETAALTERMIJN_DAGEN,
};
