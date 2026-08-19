const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { influencerFilter, magInfluencerZien } = require('../middleware/scope');
const { maakConceptVerkoopfactuur } = require('../services/facturen');
const { notificeerRollen } = require('../services/notificaties');

const router = express.Router();
router.use(authenticate);

// Statussen die de samenwerking naar het archief verplaatsen
const ARCHIEF_STATUSSEN = ['gepost', 'afgerond', 'geannuleerd'];
// Statussen waarbij de manager een verkoopfactuur moet maken
const FACTUUR_STATUSSEN = ['gepost', 'afgerond'];

const BASIS_SELECT = `
  SELECT c.*,
         i.naam AS influencer_naam,
         i.gebruikersnaam AS influencer_gebruikersnaam,
         sf.factuurnummer AS verkoopfactuur_nummer,
         sf.status        AS verkoopfactuur_status,
         sf.influencer_vrijgegeven AS influencer_vrijgegeven
  FROM collaborations c
  JOIN influencers i ON c.influencer_id = i.id
  LEFT JOIN sales_invoices sf ON c.sales_invoice_id = sf.id
`;

// ════════════════════════════════════════════════════════════
// GET /api/collaborations/factureerbaar
// Samenwerkingen waarvoor de influencer (of de PA namens de influencer) een
// eigen factuur mag maken: alleen samenwerkingen die de manager al aan de
// klant heeft gefactureerd én heeft vrijgegeven, en die nog geen eigen
// factuur hebben.
// ════════════════════════════════════════════════════════════
router.get('/factureerbaar', (req, res) => {
  const db = getDb();
  const { influencer_id } = req.query;

  let sql = `
    ${BASIS_SELECT}
    JOIN sales_invoices s ON c.sales_invoice_id = s.id
    WHERE s.influencer_vrijgegeven = 1
      AND s.status IN ('goedgekeurd','verzonden','betaald')
      AND NOT EXISTS (
        SELECT 1 FROM influencer_invoices f
        WHERE f.collaboration_id = c.id AND f.status <> 'geannuleerd'
      )
  `;
  const params = [];

  if (influencer_id) { sql += ` AND c.influencer_id = ?`; params.push(influencer_id); }

  const scope = influencerFilter(req, 'c.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY s.verzonden_op DESC, c.post_datum DESC, c.id DESC`;

  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/collaborations  — Front (lopend) of archief
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, status, archief, zoek } = req.query;

  let sql = `${BASIS_SELECT} WHERE 1=1`;
  const params = [];

  if (influencer_id) { sql += ` AND c.influencer_id = ?`; params.push(influencer_id); }
  if (status)        { sql += ` AND c.status = ?`;        params.push(status); }
  if (archief !== undefined && archief !== '') {
    sql += ` AND c.gearchiveerd = ?`;
    params.push(archief === 'true' || archief === '1' ? 1 : 0);
  }
  if (zoek) {
    sql += ` AND (c.titel LIKE ? OR c.klant LIKE ? OR c.omschrijving LIKE ?)`;
    params.push(`%${zoek}%`, `%${zoek}%`, `%${zoek}%`);
  }

  const scope = influencerFilter(req, 'c.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY COALESCE(c.post_datum, c.deadline, c.aangemaakt) DESC, c.id DESC`;

  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/collaborations/:id  — Detail
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();
  const samenwerking = db.prepare(`${BASIS_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!samenwerking) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, samenwerking.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const historie = db.prepare(`
    SELECT h.*, u.naam AS gebruiker_naam
    FROM collaboration_status_history h
    LEFT JOIN users u ON h.gewijzigd_door = u.id
    WHERE h.collaboration_id = ?
    ORDER BY h.aangemaakt DESC
  `).all(req.params.id);

  const eigenFacturen = db.prepare(`
    SELECT * FROM influencer_invoices WHERE collaboration_id = ? ORDER BY aangemaakt DESC
  `).all(req.params.id);

  res.json({ ...samenwerking, historie, influencer_facturen: eigenFacturen });
});

// ════════════════════════════════════════════════════════════
// POST /api/collaborations  — Aanmaken
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('pa', 'manager', 'staff'), (req, res) => {
  const db = getDb();
  const {
    influencer_id, klant, klant_contact, klant_email, klant_adres,
    titel, omschrijving, bedrag, btw_percentage, valuta,
    briefing_id, content_post_id, platform, deadline, post_datum, status, notities,
  } = req.body;

  if (!influencer_id || !klant || !titel) {
    return res.status(400).json({ error: 'Influencer, klant en titel zijn verplicht' });
  }

  const result = db.prepare(`
    INSERT INTO collaborations
      (influencer_id, klant, klant_contact, klant_email, klant_adres, titel, omschrijving,
       bedrag, btw_percentage, valuta, briefing_id, content_post_id, platform,
       deadline, post_datum, status, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    influencer_id, klant, klant_contact || null, klant_email || null, klant_adres || null,
    titel, omschrijving || null,
    parseFloat(bedrag || 0), parseFloat(btw_percentage ?? 21), valuta || 'EUR',
    briefing_id || null, content_post_id || null, platform || null,
    deadline || null, post_datum || null, status || 'aanvraag', notities || null
  );

  res.status(201).json(db.prepare(`${BASIS_SELECT} WHERE c.id = ?`).get(result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PUT /api/collaborations/:id  — Bewerken
// ════════════════════════════════════════════════════════════
router.put('/:id', requireRole('pa', 'manager', 'staff'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });

  const velden = [
    'klant', 'klant_contact', 'klant_email', 'klant_adres', 'titel', 'omschrijving',
    'bedrag', 'btw_percentage', 'valuta', 'briefing_id', 'content_post_id',
    'platform', 'deadline', 'post_datum', 'notities',
  ];
  const waarden = velden.map(v => (req.body[v] !== undefined ? req.body[v] : bestaand[v]));

  db.prepare(`
    UPDATE collaborations SET
      ${velden.map(v => `${v} = ?`).join(', ')},
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(...waarden, req.params.id);

  res.json(db.prepare(`${BASIS_SELECT} WHERE c.id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/collaborations/:id/status
// Zodra er gepost is (of de samenwerking wordt afgerond):
//   1. de samenwerking gaat naar het archief
//   2. er wordt automatisch een CONCEPT-verkoopfactuur klaargezet
//   3. de manager krijgt een pop-up om die factuur te controleren en te sturen
// ════════════════════════════════════════════════════════════
router.patch('/:id/status', requireRole('pa', 'manager', 'staff'), (req, res) => {
  const db = getDb();
  const { status, notitie, post_datum } = req.body;

  const toegestaan = ['aanvraag', 'bevestigd', 'in_productie', 'gepost', 'afgerond', 'geannuleerd'];
  if (!toegestaan.includes(status)) {
    return res.status(400).json({ error: 'Ongeldige status' });
  }

  const bestaand = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });

  const gearchiveerd = ARCHIEF_STATUSSEN.includes(status);
  let resultaat;

  const transactie = db.transaction(() => {
    // Bij "gepost" leggen we de postdatum vast als die er nog niet is
    const nieuwePostDatum = post_datum
      || bestaand.post_datum
      || (status === 'gepost' ? new Date().toISOString().split('T')[0] : null);

    db.prepare(`
      UPDATE collaborations SET
        status = ?,
        post_datum = ?,
        gearchiveerd = ?,
        gearchiveerd_op = ?,
        bijgewerkt = datetime('now')
      WHERE id = ?
    `).run(
      status,
      nieuwePostDatum,
      gearchiveerd ? 1 : 0,
      gearchiveerd ? (bestaand.gearchiveerd_op || new Date().toISOString().replace('T', ' ').slice(0, 19)) : null,
      req.params.id
    );

    db.prepare(`
      INSERT INTO collaboration_status_history (collaboration_id, van_status, naar_status, notitie, gewijzigd_door)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, bestaand.status, status, notitie || null, req.user.id);

    const bijgewerkt = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(req.params.id);
    let factuur = null;

    if (FACTUUR_STATUSSEN.includes(status)) {
      const { factuur: f, nieuw } = maakConceptVerkoopfactuur(bijgewerkt, req.user.id, db);
      factuur = f;

      if (nieuw) {
        const influencer = db.prepare(`SELECT naam FROM influencers WHERE id = ?`).get(bijgewerkt.influencer_id);
        notificeerRollen(['manager'], {
          type: 'samenwerking_afgerond',
          titel: 'Samenwerking afgerond',
          bericht:
            `De samenwerking "${bijgewerkt.titel}" van ${influencer?.naam || 'de influencer'} met ` +
            `${bijgewerkt.klant} is afgerond. Verkoopfactuur ${f.factuurnummer} staat als concept klaar — ` +
            `controleer en verstuur hem naar de klant.`,
          entiteit_type: 'sales_invoice',
          entiteit_id: f.id,
          link: `/verkoopfacturen?factuur=${f.id}`,
          prioriteit: 'hoog',
        }, db);
      }
    }

    resultaat = {
      samenwerking: db.prepare(`${BASIS_SELECT} WHERE c.id = ?`).get(req.params.id),
      verkoopfactuur: factuur,
    };
  });

  transactie();
  res.json(resultaat);
});

// ════════════════════════════════════════════════════════════
// DELETE /api/collaborations/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('pa', 'manager'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });
  if (bestaand.sales_invoice_id) {
    return res.status(409).json({
      error: 'Deze samenwerking is al gefactureerd en kan niet meer verwijderd worden. Annuleer hem in plaats daarvan.',
    });
  }
  db.prepare(`DELETE FROM collaborations WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
