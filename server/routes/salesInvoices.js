const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { berekenBtw, vervaldatum, volgendVerkoopfactuurnummer } = require('../services/facturen');
const { notificeerRollen, notificeerInfluencer } = require('../services/notificaties');
const { verstuurMail, verkoopfactuurMail } = require('../services/mailer');

const router = express.Router();

// ────────────────────────────────────────────────────────────
// Verkoopfacturen zijn EIGENDOM VAN DE MANAGER.
// De PA, staff en influencers hebben hier geen toegang toe; de influencer
// maakt een eigen factuur via /api/influencer-invoices.
// ────────────────────────────────────────────────────────────
router.use(authenticate, requireRole('manager'));

const BASIS_SELECT = `
  SELECT s.*,
         i.naam AS influencer_naam,
         c.titel AS samenwerking_titel,
         c.post_datum AS samenwerking_post_datum,
         (SELECT COUNT(*) FROM influencer_invoices f
           WHERE f.sales_invoice_id = s.id AND f.status <> 'geannuleerd') AS influencer_facturen
  FROM sales_invoices s
  JOIN influencers i ON s.influencer_id = i.id
  LEFT JOIN collaborations c ON s.collaboration_id = c.id
`;

function haal(db, id) {
  return db.prepare(`${BASIS_SELECT} WHERE s.id = ?`).get(id);
}

// ════════════════════════════════════════════════════════════
// GET /api/sales-invoices  — Lijst (filterbaar per influencer)
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, status, zoek } = req.query;

  let sql = `${BASIS_SELECT} WHERE 1=1`;
  const params = [];

  if (influencer_id) { sql += ` AND s.influencer_id = ?`; params.push(influencer_id); }
  if (status)        { sql += ` AND s.status = ?`;        params.push(status); }
  if (zoek) {
    sql += ` AND (s.factuurnummer LIKE ? OR s.klant LIKE ? OR s.omschrijving LIKE ?)`;
    params.push(`%${zoek}%`, `%${zoek}%`, `%${zoek}%`);
  }

  sql += ` ORDER BY s.factuurdatum DESC, s.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/sales-invoices/samenvatting
// ════════════════════════════════════════════════════════════
router.get('/samenvatting', (req, res) => {
  const db = getDb();
  const { influencer_id } = req.query;

  let waar = `WHERE status <> 'geannuleerd'`;
  const params = [];
  if (influencer_id) { waar += ` AND influencer_id = ?`; params.push(influencer_id); }

  const rij = db.prepare(`
    SELECT
      COUNT(*)                                                            AS totaal_facturen,
      COALESCE(SUM(totaal), 0)                                            AS totaal_bedrag,
      COALESCE(SUM(CASE WHEN status = 'concept'     THEN totaal END), 0)  AS concept_bedrag,
      COALESCE(SUM(CASE WHEN status = 'verzonden'   THEN totaal END), 0)  AS openstaand_bedrag,
      COALESCE(SUM(CASE WHEN status = 'betaald'     THEN totaal END), 0)  AS betaald_bedrag,
      COALESCE(SUM(CASE WHEN status = 'concept'     THEN 1 END), 0)       AS aantal_concept,
      COALESCE(SUM(CASE WHEN status = 'goedgekeurd' THEN 1 END), 0)       AS aantal_goedgekeurd
    FROM sales_invoices ${waar}
  `).get(...params);

  res.json(rij);
});

// ════════════════════════════════════════════════════════════
// GET /api/sales-invoices/:id
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();
  const factuur = haal(db, req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });

  factuur.influencer_facturen_lijst = db.prepare(
    `SELECT * FROM influencer_invoices WHERE sales_invoice_id = ? ORDER BY aangemaakt DESC`
  ).all(req.params.id);

  res.json(factuur);
});

// ════════════════════════════════════════════════════════════
// POST /api/sales-invoices  — Handmatig aanmaken
// ════════════════════════════════════════════════════════════
router.post('/', (req, res) => {
  const db = getDb();
  const {
    collaboration_id, influencer_id, klant, klant_contact, klant_email, klant_adres,
    omschrijving, bedrag, btw_percentage, valuta, factuurdatum, vervaldatum: vervalIn, notities,
  } = req.body;

  if (!influencer_id || !klant || !omschrijving) {
    return res.status(400).json({ error: 'Influencer, klant en omschrijving zijn verplicht' });
  }

  const datum = factuurdatum || new Date().toISOString().split('T')[0];
  const bedragen = berekenBtw(bedrag, btw_percentage ?? 21);

  const result = db.prepare(`
    INSERT INTO sales_invoices
      (factuurnummer, collaboration_id, influencer_id, klant, klant_contact, klant_email, klant_adres,
       omschrijving, bedrag, btw_percentage, btw_bedrag, totaal, valuta,
       factuurdatum, vervaldatum, status, aangemaakt_door, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concept', ?, ?)
  `).run(
    volgendVerkoopfactuurnummer(db), collaboration_id || null, influencer_id,
    klant, klant_contact || null, klant_email || null, klant_adres || null,
    omschrijving, bedragen.bedrag, btw_percentage ?? 21, bedragen.btw_bedrag, bedragen.totaal,
    valuta || 'EUR', datum, vervalIn || vervaldatum(datum), req.user.id, notities || null
  );

  if (collaboration_id) {
    db.prepare(`UPDATE collaborations SET sales_invoice_id = ?, bijgewerkt = datetime('now') WHERE id = ?`)
      .run(result.lastInsertRowid, collaboration_id);
  }

  res.status(201).json(haal(db, result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PUT /api/sales-invoices/:id  — Bewerken (alleen zolang het concept is)
// ════════════════════════════════════════════════════════════
router.put('/:id', (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });
  if (bestaand.status !== 'concept') {
    return res.status(409).json({ error: 'Een factuur kan alleen als concept bewerkt worden' });
  }

  const bedrag         = req.body.bedrag         !== undefined ? req.body.bedrag         : bestaand.bedrag;
  const btw_percentage = req.body.btw_percentage !== undefined ? req.body.btw_percentage : bestaand.btw_percentage;
  const bedragen = berekenBtw(bedrag, btw_percentage);

  db.prepare(`
    UPDATE sales_invoices SET
      klant = ?, klant_contact = ?, klant_email = ?, klant_adres = ?, omschrijving = ?,
      bedrag = ?, btw_percentage = ?, btw_bedrag = ?, totaal = ?, valuta = ?,
      factuurdatum = ?, vervaldatum = ?, notities = ?, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    req.body.klant         ?? bestaand.klant,
    req.body.klant_contact ?? bestaand.klant_contact,
    req.body.klant_email   ?? bestaand.klant_email,
    req.body.klant_adres   ?? bestaand.klant_adres,
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
// PATCH /api/sales-invoices/:id/goedkeuren
// De manager checkt de factuur eerst; pas daarna mag hij de deur uit.
// ════════════════════════════════════════════════════════════
router.patch('/:id/goedkeuren', (req, res) => {
  const db = getDb();
  const factuur = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (factuur.status !== 'concept') {
    return res.status(409).json({ error: 'Alleen een conceptfactuur kan goedgekeurd worden' });
  }

  db.prepare(`
    UPDATE sales_invoices SET
      status = 'goedgekeurd', goedgekeurd_door = ?, goedgekeurd_op = datetime('now'),
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(req.user.id, req.params.id);

  db.prepare(`
    UPDATE notifications SET afgehandeld = 1, afgehandeld_op = datetime('now')
    WHERE entiteit_type = 'sales_invoice' AND entiteit_id = ? AND type = 'samenwerking_afgerond'
  `).run(req.params.id);

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// POST /api/sales-invoices/:id/versturen
// De factuur gaat naar de klant. Pas op dat moment komt de samenwerking
// vrij voor de influencer: pop-up naar de influencer én naar de PA, plus
// een bericht in het portaal dat de eigen factuur gestuurd mag worden.
// ════════════════════════════════════════════════════════════
router.post('/:id/versturen', async (req, res) => {
  const db = getDb();
  const factuur = haal(db, req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });

  if (!['goedgekeurd', 'verzonden'].includes(factuur.status)) {
    return res.status(409).json({
      error: 'Keur de factuur eerst goed voordat je hem naar de klant stuurt',
    });
  }

  const naar = req.body.naar || factuur.klant_email;
  if (!naar) {
    return res.status(400).json({ error: 'Geen e-mailadres van de klant bekend' });
  }

  const { onderwerp, tekst } = verkoopfactuurMail(factuur);
  const mail = await verstuurMail({ naar, onderwerp, tekst });

  const alVrijgegeven = factuur.influencer_vrijgegeven === 1;

  const transactie = db.transaction(() => {
    db.prepare(`
      UPDATE sales_invoices SET
        status = 'verzonden',
        verzonden_op = COALESCE(verzonden_op, datetime('now')),
        verzonden_naar = ?,
        influencer_vrijgegeven = 1,
        influencer_vrijgegeven_op = COALESCE(influencer_vrijgegeven_op, datetime('now')),
        influencer_vrijgegeven_door = COALESCE(influencer_vrijgegeven_door, ?),
        bijgewerkt = datetime('now')
      WHERE id = ?
    `).run(naar, req.user.id, req.params.id);

    if (!alVrijgegeven) {
      const bericht =
        `De factuur voor "${factuur.samenwerking_titel || factuur.omschrijving}" met ${factuur.klant} is ` +
        `naar de klant verstuurd. ${factuur.influencer_naam} kan nu de eigen factuur naar ` +
        `${process.env.ORGANISATIE_NAAM || 'Scala Management'} sturen.`;

      // Pop-up voor de influencer zelf
      notificeerInfluencer(factuur.influencer_id, {
        type: 'factuur_vrijgegeven',
        titel: 'Je kunt je factuur sturen',
        bericht,
        entiteit_type: 'sales_invoice',
        entiteit_id: factuur.id,
        link: `/mijn-facturen?samenwerking=${factuur.collaboration_id || ''}`,
        prioriteit: 'hoog',
      }, db);

      // Pop-up voor de PA, die de factuur namens de influencer mag maken
      notificeerRollen(['pa'], {
        type: 'factuur_vrijgegeven',
        titel: `Factuur klaar voor ${factuur.influencer_naam}`,
        bericht,
        entiteit_type: 'sales_invoice',
        entiteit_id: factuur.id,
        link: `/mijn-facturen?influencer=${factuur.influencer_id}&samenwerking=${factuur.collaboration_id || ''}`,
        prioriteit: 'hoog',
      }, db);

      // Bericht in het influencer-portaal
      db.prepare(`
        INSERT INTO portal_messages
          (influencer_id, van_user_id, type, onderwerp, bericht, sales_invoice_id, collaboration_id)
        VALUES (?, ?, 'factuur_verzoek', ?, ?, ?, ?)
      `).run(
        factuur.influencer_id, req.user.id,
        'Je kunt je factuur sturen',
        `${bericht}\n\nGa naar "Mijn facturen" en kies de samenwerking om je factuur op te stellen.`,
        factuur.id, factuur.collaboration_id || null
      );
    }
  });

  transactie();
  res.json({ factuur: haal(db, req.params.id), mail });
});

// ════════════════════════════════════════════════════════════
// POST /api/sales-invoices/:id/vrijgeven
// Handmatig vrijgeven, voor het geval de factuur buiten het systeem om is
// verstuurd. Kan pas na akkoord van de manager.
// ════════════════════════════════════════════════════════════
router.post('/:id/vrijgeven', (req, res) => {
  const db = getDb();
  const factuur = haal(db, req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (!['goedgekeurd', 'verzonden', 'betaald'].includes(factuur.status)) {
    return res.status(409).json({ error: 'Keur de factuur eerst goed' });
  }
  if (factuur.influencer_vrijgegeven) {
    return res.json({ factuur, alVrijgegeven: true });
  }

  const bericht = req.body.bericht ||
    `De samenwerking "${factuur.samenwerking_titel || factuur.omschrijving}" met ${factuur.klant} is gefactureerd. ` +
    `Je kunt je eigen factuur nu naar ${process.env.ORGANISATIE_NAAM || 'Scala Management'} sturen.`;

  const transactie = db.transaction(() => {
    db.prepare(`
      UPDATE sales_invoices SET
        influencer_vrijgegeven = 1,
        influencer_vrijgegeven_op = datetime('now'),
        influencer_vrijgegeven_door = ?,
        bijgewerkt = datetime('now')
      WHERE id = ?
    `).run(req.user.id, req.params.id);

    notificeerInfluencer(factuur.influencer_id, {
      type: 'factuur_vrijgegeven',
      titel: 'Je kunt je factuur sturen',
      bericht,
      entiteit_type: 'sales_invoice',
      entiteit_id: factuur.id,
      link: `/mijn-facturen?samenwerking=${factuur.collaboration_id || ''}`,
      prioriteit: 'hoog',
    }, db);

    notificeerRollen(['pa'], {
      type: 'factuur_vrijgegeven',
      titel: `Factuur klaar voor ${factuur.influencer_naam}`,
      bericht,
      entiteit_type: 'sales_invoice',
      entiteit_id: factuur.id,
      link: `/mijn-facturen?influencer=${factuur.influencer_id}&samenwerking=${factuur.collaboration_id || ''}`,
      prioriteit: 'hoog',
    }, db);

    db.prepare(`
      INSERT INTO portal_messages
        (influencer_id, van_user_id, type, onderwerp, bericht, sales_invoice_id, collaboration_id)
      VALUES (?, ?, 'factuur_verzoek', ?, ?, ?, ?)
    `).run(factuur.influencer_id, req.user.id, 'Je kunt je factuur sturen', bericht,
           factuur.id, factuur.collaboration_id || null);
  });

  transactie();
  res.json({ factuur: haal(db, req.params.id) });
});

// ════════════════════════════════════════════════════════════
// PATCH /api/sales-invoices/:id/betaald
// ════════════════════════════════════════════════════════════
router.patch('/:id/betaald', (req, res) => {
  const db = getDb();
  const { betaald, betaald_op } = req.body;
  const factuur = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });

  db.prepare(`
    UPDATE sales_invoices SET
      status = ?, betaald_op = ?, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    betaald === false ? (factuur.verzonden_op ? 'verzonden' : 'goedgekeurd') : 'betaald',
    betaald === false ? null : (betaald_op || new Date().toISOString().split('T')[0]),
    req.params.id
  );

  // De samenwerking is nu financieel rond
  if (betaald !== false && factuur.collaboration_id) {
    db.prepare(`
      UPDATE collaborations SET status = 'afgerond', bijgewerkt = datetime('now')
      WHERE id = ? AND status = 'gepost'
    `).run(factuur.collaboration_id);
  }

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// DELETE /api/sales-invoices/:id  — Alleen concepten
// ════════════════════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  const db = getDb();
  const factuur = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(req.params.id);
  if (!factuur) return res.status(404).json({ error: 'Niet gevonden' });
  if (factuur.status !== 'concept') {
    return res.status(409).json({ error: 'Alleen een conceptfactuur kan verwijderd worden' });
  }

  const transactie = db.transaction(() => {
    db.prepare(`UPDATE collaborations SET sales_invoice_id = NULL WHERE sales_invoice_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM notifications WHERE entiteit_type = 'sales_invoice' AND entiteit_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM sales_invoices WHERE id = ?`).run(req.params.id);
  });
  transactie();

  res.json({ ok: true });
});

module.exports = router;
