const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { influencerFilter, magInfluencerZien } = require('../middleware/scope');
const { berekenBtw, vervaldatum } = require('../services/facturen');
const { verstuurMail, influencerFactuurMail } = require('../services/mailer');
const { notificeerRollen } = require('../services/notificaties');

const router = express.Router();
router.use(authenticate);

// De influencer factureert de eigen vergoeding aan het management.
const ONTVANGER       = process.env.ORGANISATIE_NAAM  || 'Scala Management';
const ONTVANGER_EMAIL = process.env.ORGANISATIE_EMAIL || process.env.SCALA_FACTUUR_EMAIL || '';

const BASIS_SELECT = `
  SELECT f.*,
         i.naam  AS influencer_naam,
         c.titel AS samenwerking_titel,
         c.klant AS klant,
         s.factuurnummer AS verkoopfactuur_nummer
  FROM influencer_invoices f
  JOIN influencers i ON f.influencer_id = i.id
  JOIN collaborations c ON f.collaboration_id = c.id
  LEFT JOIN sales_invoices s ON f.sales_invoice_id = s.id
`;

function haal(db, id) {
  return db.prepare(`${BASIS_SELECT} WHERE f.id = ?`).get(id);
}

/**
 * Een influencerfactuur mag alleen bij een samenwerking die de manager al aan
 * de klant heeft gefactureerd én heeft vrijgegeven.
 */
function controleerVrijgave(db, collaborationId) {
  const rij = db.prepare(`
    SELECT c.id, c.influencer_id, c.titel, c.klant, c.bedrag, c.btw_percentage, c.valuta,
           s.id AS sales_invoice_id, s.status AS factuur_status, s.influencer_vrijgegeven
    FROM collaborations c
    LEFT JOIN sales_invoices s ON c.sales_invoice_id = s.id
    WHERE c.id = ?
  `).get(collaborationId);

  if (!rij) return { ok: false, code: 404, error: 'Samenwerking niet gevonden' };
  if (!rij.sales_invoice_id || !rij.influencer_vrijgegeven ||
      !['goedgekeurd', 'verzonden', 'betaald'].includes(rij.factuur_status)) {
    return {
      ok: false, code: 409,
      error: 'Deze samenwerking is nog niet door de manager gefactureerd. Je kunt pas een factuur maken zodra de manager de factuur naar de klant heeft gestuurd.',
    };
  }
  return { ok: true, samenwerking: rij };
}

/**
 * Volgend factuurnummer binnen de eigen reeks van de influencer.
 */
function volgendNummer(db, influencerId, jaar = new Date().getFullYear()) {
  const rijen = db.prepare(
    `SELECT factuurnummer FROM influencer_invoices WHERE influencer_id = ? AND factuurnummer LIKE ?`
  ).all(influencerId, `${jaar}-%`);

  const hoogste = rijen.reduce((max, r) => {
    const n = parseInt(String(r.factuurnummer).split('-')[1], 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);

  return `${jaar}-${String(hoogste + 1).padStart(3, '0')}`;
}

// ════════════════════════════════════════════════════════════
// GET /api/influencer-invoices  — Lijst
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, status, zoek } = req.query;

  let sql = `${BASIS_SELECT} WHERE 1=1`;
  const params = [];

  if (influencer_id) { sql += ` AND f.influencer_id = ?`; params.push(influencer_id); }
  if (status)        { sql += ` AND f.status = ?`;        params.push(status); }
  if (zoek) {
    sql += ` AND (f.factuurnummer LIKE ? OR f.omschrijving LIKE ? OR c.klant LIKE ?)`;
    params.push(`%${zoek}%`, `%${zoek}%`, `%${zoek}%`);
  }

  const scope = influencerFilter(req, 'f.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY f.factuurdatum DESC, f.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/influencer-invoices/ontvanger — waar gaat de factuur heen
// ════════════════════════════════════════════════════════════
router.get('/ontvanger', (req, res) => {
  res.json({ ontvanger: ONTVANGER, ontvanger_email: ONTVANGER_EMAIL });
});

// ════════════════════════════════════════════════════════════
// GET /api/influencer-invoices/:id
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();
  const factuur = haal(db, req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, factuur.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  res.json(factuur);
});

// ════════════════════════════════════════════════════════════
// POST /api/influencer-invoices  — Aanmaken
// De influencer zelf, of de PA namens de influencer.
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('influencer', 'pa'), (req, res) => {
  const db = getDb();
  const {
    collaboration_id, omschrijving, bedrag, btw_percentage,
    valuta, factuurdatum, vervaldatum: vervalIn, factuurnummer, notities,
  } = req.body;

  if (!collaboration_id) {
    return res.status(400).json({ error: 'Kies eerst een gefactureerde samenwerking' });
  }

  const check = controleerVrijgave(db, collaboration_id);
  if (!check.ok) return res.status(check.code).json({ error: check.error });

  const { samenwerking } = check;
  if (!magInfluencerZien(req, samenwerking.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const bestaat = db.prepare(
    `SELECT id FROM influencer_invoices WHERE collaboration_id = ? AND status <> 'geannuleerd'`
  ).get(collaboration_id);
  if (bestaat) {
    return res.status(409).json({ error: 'Voor deze samenwerking bestaat al een factuur' });
  }

  const datum = factuurdatum || new Date().toISOString().split('T')[0];
  const bedragen = berekenBtw(
    bedrag !== undefined ? bedrag : samenwerking.bedrag,
    btw_percentage ?? samenwerking.btw_percentage ?? 21
  );

  const result = db.prepare(`
    INSERT INTO influencer_invoices
      (factuurnummer, influencer_id, collaboration_id, sales_invoice_id, omschrijving,
       bedrag, btw_percentage, btw_bedrag, totaal, valuta, factuurdatum, vervaldatum,
       status, ontvanger, ontvanger_email, aangemaakt_door, aangemaakt_namens, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concept', ?, ?, ?, ?, ?)
  `).run(
    factuurnummer || volgendNummer(db, samenwerking.influencer_id),
    samenwerking.influencer_id,
    collaboration_id,
    samenwerking.sales_invoice_id,
    omschrijving || `${samenwerking.titel} — ${samenwerking.klant}`,
    bedragen.bedrag,
    btw_percentage ?? samenwerking.btw_percentage ?? 21,
    bedragen.btw_bedrag,
    bedragen.totaal,
    valuta || samenwerking.valuta || 'EUR',
    datum,
    vervalIn || vervaldatum(datum),
    ONTVANGER,
    ONTVANGER_EMAIL || null,
    req.user.id,
    req.user.rol === 'pa' ? 'pa' : 'influencer',
    notities || null
  );

  res.status(201).json(haal(db, result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PUT /api/influencer-invoices/:id  — Bewerken zolang het concept is
// ════════════════════════════════════════════════════════════
router.put('/:id', requireRole('influencer', 'pa'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM influencer_invoices WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, bestaand.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  if (bestaand.status !== 'concept') {
    return res.status(409).json({ error: 'Een verstuurde factuur kan niet meer bewerkt worden' });
  }

  const bedrag         = req.body.bedrag         !== undefined ? req.body.bedrag         : bestaand.bedrag;
  const btw_percentage = req.body.btw_percentage !== undefined ? req.body.btw_percentage : bestaand.btw_percentage;
  const bedragen = berekenBtw(bedrag, btw_percentage);

  db.prepare(`
    UPDATE influencer_invoices SET
      factuurnummer = ?, omschrijving = ?, bedrag = ?, btw_percentage = ?, btw_bedrag = ?,
      totaal = ?, valuta = ?, factuurdatum = ?, vervaldatum = ?, notities = ?,
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    req.body.factuurnummer ?? bestaand.factuurnummer,
    req.body.omschrijving  ?? bestaand.omschrijving,
    bedragen.bedrag, btw_percentage, bedragen.btw_bedrag, bedragen.totaal,
    req.body.valuta        ?? bestaand.valuta,
    req.body.factuurdatum  ?? bestaand.factuurdatum,
    req.body.vervaldatum   ?? bestaand.vervaldatum,
    req.body.notities      ?? bestaand.notities,
    req.params.id
  );

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// POST /api/influencer-invoices/:id/versturen
// De factuur gaat per e-mail naar het management.
// ════════════════════════════════════════════════════════════
router.post('/:id/versturen', requireRole('influencer', 'pa'), async (req, res) => {
  const db = getDb();
  const factuur = haal(db, req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, factuur.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  if (factuur.status === 'geannuleerd') {
    return res.status(409).json({ error: 'Deze factuur is geannuleerd' });
  }

  const naar = req.body.naar || factuur.ontvanger_email || ONTVANGER_EMAIL;
  if (!naar) {
    return res.status(400).json({
      error: `Er is geen e-mailadres van ${ONTVANGER} ingesteld. Vul ORGANISATIE_EMAIL in de serverconfiguratie in.`,
    });
  }

  const { onderwerp, tekst } = influencerFactuurMail(factuur);
  const mail = await verstuurMail({ naar, onderwerp, tekst });

  db.prepare(`
    UPDATE influencer_invoices SET
      status = 'verzonden',
      verzonden_op = COALESCE(verzonden_op, datetime('now')),
      ontvanger_email = ?, email_status = ?, email_fout = ?,
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(naar, mail.status, mail.fout || null, req.params.id);

  notificeerRollen(['manager'], {
    type: 'influencer_factuur_ontvangen',
    titel: `Factuur van ${factuur.influencer_naam}`,
    bericht:
      `${factuur.influencer_naam} heeft factuur ${factuur.factuurnummer} voor "${factuur.samenwerking_titel}" ` +
      `naar ${ONTVANGER} gestuurd.`,
    entiteit_type: 'influencer_invoice',
    entiteit_id: factuur.id,
    link: `/verkoopfacturen?influencer=${factuur.influencer_id}`,
  }, db);

  res.json({ factuur: haal(db, req.params.id), mail });
});

// ════════════════════════════════════════════════════════════
// PATCH /api/influencer-invoices/:id/betaald  — Manager of PA boekt af
// ════════════════════════════════════════════════════════════
router.patch('/:id/betaald', requireRole('manager', 'pa'), (req, res) => {
  const db = getDb();
  const { betaald, betaald_op } = req.body;
  const factuur = db.prepare(`SELECT * FROM influencer_invoices WHERE id = ?`).get(req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });

  db.prepare(`
    UPDATE influencer_invoices SET status = ?, betaald_op = ?, bijgewerkt = datetime('now') WHERE id = ?
  `).run(
    betaald === false ? 'verzonden' : 'betaald',
    betaald === false ? null : (betaald_op || new Date().toISOString().split('T')[0]),
    req.params.id
  );

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// DELETE /api/influencer-invoices/:id  — Alleen concepten
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('influencer', 'pa'), (req, res) => {
  const db = getDb();
  const factuur = db.prepare(`SELECT * FROM influencer_invoices WHERE id = ?`).get(req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, factuur.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  if (factuur.status !== 'concept') {
    return res.status(409).json({ error: 'Alleen een conceptfactuur kan verwijderd worden' });
  }
  db.prepare(`DELETE FROM influencer_invoices WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
