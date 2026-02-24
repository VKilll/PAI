const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── Multer configuratie ───────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/finance');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const opslag = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniek = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${uniek}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage: opslag,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const toegestaan = /pdf|jpeg|jpg|png|webp/.test(file.mimetype);
    cb(null, toegestaan);
  },
});

// ════════════════════════════════════════════════════════════
// GET /api/finance/categorieën
// ════════════════════════════════════════════════════════════
router.get('/categorieen', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`SELECT * FROM finance_categories ORDER BY type, naam`).all());
});

// ════════════════════════════════════════════════════════════
// GET /api/finance/samenvatting  — Totalen per periode
// ════════════════════════════════════════════════════════════
router.get('/samenvatting', (req, res) => {
  const db = getDb();
  const { influencer_id, maand, jaar } = req.query;

  let waar = `WHERE 1=1`;
  const params = [];

  if (influencer_id) { waar += ` AND f.influencer_id = ?`; params.push(influencer_id); }
  if (maand && jaar) {
    waar += ` AND strftime('%Y-%m', f.datum) = ?`;
    params.push(`${jaar}-${String(maand).padStart(2, '0')}`);
  } else if (jaar) {
    waar += ` AND strftime('%Y', f.datum) = ?`;
    params.push(String(jaar));
  }

  const rij = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN fc.type = 'inkomsten' THEN f.bedrag ELSE 0 END), 0) AS totaal_inkomsten,
      COALESCE(SUM(CASE WHEN fc.type = 'uitgaven'  THEN f.bedrag ELSE 0 END), 0) AS totaal_uitgaven,
      COALESCE(SUM(CASE WHEN f.betaald = 0 AND fc.type = 'inkomsten' THEN f.bedrag ELSE 0 END), 0) AS openstaand_inkomsten,
      COALESCE(SUM(CASE WHEN f.betaald = 0 AND fc.type = 'uitgaven'  THEN f.bedrag ELSE 0 END), 0) AS openstaand_uitgaven,
      COUNT(*) AS totaal_items
    FROM finance_items f
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    ${waar}
  `).get(...params);

  res.json({
    ...rij,
    saldo: rij.totaal_inkomsten - rij.totaal_uitgaven,
  });
});

// ════════════════════════════════════════════════════════════
// GET /api/finance/week-overzicht  — Wekelijks betalingsoverzicht
// ════════════════════════════════════════════════════════════
router.get('/week-overzicht', (req, res) => {
  const db = getDb();
  const { influencer_id } = req.query;

  // Haal onbetaalde items op van de afgelopen 30 dagen + komende 14 dagen
  let sql = `
    SELECT f.*, fc.naam AS categorie_naam, fc.type AS categorie_type,
           i.naam AS influencer_naam
    FROM finance_items f
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    JOIN influencers i ON f.influencer_id = i.id
    WHERE f.betaald = 0
    AND f.datum BETWEEN date('now', '-30 days') AND date('now', '+14 days')
  `;
  const params = [];
  if (influencer_id) { sql += ` AND f.influencer_id = ?`; params.push(influencer_id); }
  sql += ` ORDER BY f.datum ASC`;

  const items = db.prepare(sql).all(...params);

  const totaalIn  = items.filter(i => i.categorie_type === 'inkomsten').reduce((s, i) => s + i.bedrag, 0);
  const totaalUit = items.filter(i => i.categorie_type === 'uitgaven').reduce((s, i) => s + i.bedrag, 0);

  res.json({
    periode: 'afgelopen 30 dagen + komende 14 dagen',
    gegenereerd: new Date().toISOString(),
    items,
    totaal_te_ontvangen: totaalIn,
    totaal_te_betalen: totaalUit,
    saldo: totaalIn - totaalUit,
  });
});

// ════════════════════════════════════════════════════════════
// GET /api/finance/maand-export  — CSV export voor accountant
// ════════════════════════════════════════════════════════════
router.get('/maand-export', requireRole('pa'), (req, res) => {
  const db = getDb();
  const { maand, jaar, influencer_id } = req.query;

  if (!maand || !jaar) {
    return res.status(400).json({ error: 'Maand en jaar zijn verplicht' });
  }

  let sql = `
    SELECT f.*, fc.naam AS categorie_naam, fc.type AS categorie_type, i.naam AS influencer_naam
    FROM finance_items f
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    JOIN influencers i ON f.influencer_id = i.id
    WHERE strftime('%Y-%m', f.datum) = ?
  `;
  const params = [`${jaar}-${String(maand).padStart(2, '0')}`];
  if (influencer_id) { sql += ` AND f.influencer_id = ?`; params.push(influencer_id); }
  sql += ` ORDER BY f.datum ASC`;

  const items = db.prepare(sql).all(...params);

  // CSV opbouwen
  const maandNamen = ['','Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
  const koptekst = `PA Atelier — Financieel overzicht ${maandNamen[parseInt(maand)]} ${jaar}\n\n`;

  const csvRijen = [
    ['Datum','Type','Omschrijving','Opdrachtgever','Categorie','Bedrag (EUR)','BTW','Betaald','Betaald op','Influencer'].join(';'),
    ...items.map(i => [
      i.datum,
      i.type,
      `"${(i.omschrijving || '').replace(/"/g, '""')}"`,
      `"${(i.opdrachtgever || '').replace(/"/g, '""')}"`,
      i.categorie_naam || '',
      i.bedrag.toFixed(2).replace('.', ','),
      (i.btw_bedrag || 0).toFixed(2).replace('.', ','),
      i.betaald ? 'Ja' : 'Nee',
      i.betaald_datum || '',
      i.influencer_naam,
    ].join(';')),
  ];

  const totaalIn  = items.filter(i => i.categorie_type === 'inkomsten').reduce((s, i) => s + i.bedrag, 0);
  const totaalUit = items.filter(i => i.categorie_type === 'uitgaven').reduce((s, i)  => s + i.bedrag, 0);
  csvRijen.push('');
  csvRijen.push(`Totaal inkomsten;${totaalIn.toFixed(2).replace('.', ',')}`);
  csvRijen.push(`Totaal uitgaven;${totaalUit.toFixed(2).replace('.', ',')}`);
  csvRijen.push(`Saldo;${(totaalIn - totaalUit).toFixed(2).replace('.', ',')}`);

  const csv = koptekst + csvRijen.join('\n');
  const bestandsnaam = `financieel-overzicht-${jaar}-${String(maand).padStart(2, '0')}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${bestandsnaam}"`);
  res.send('\uFEFF' + csv); // BOM voor Excel compatibiliteit
});

// ════════════════════════════════════════════════════════════
// GET /api/finance  — Lijst
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, type, betaald, categorie_id, maand, jaar, zoek } = req.query;

  let sql = `
    SELECT f.*, fc.naam AS categorie_naam, fc.type AS categorie_type, i.naam AS influencer_naam
    FROM finance_items f
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    JOIN influencers i ON f.influencer_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (influencer_id) { sql += ` AND f.influencer_id = ?`;         params.push(influencer_id); }
  if (type)          { sql += ` AND f.type = ?`;                   params.push(type); }
  if (betaald !== undefined && betaald !== '') { sql += ` AND f.betaald = ?`; params.push(betaald === 'true' ? 1 : 0); }
  if (categorie_id)  { sql += ` AND f.categorie_id = ?`;           params.push(categorie_id); }
  if (maand && jaar) { sql += ` AND strftime('%Y-%m', f.datum) = ?`; params.push(`${jaar}-${String(maand).padStart(2, '0')}`); }
  else if (jaar)     { sql += ` AND strftime('%Y', f.datum) = ?`;  params.push(String(jaar)); }
  if (zoek)          { sql += ` AND (f.omschrijving LIKE ? OR f.opdrachtgever LIKE ?)`; params.push(`%${zoek}%`, `%${zoek}%`); }

  sql += ` ORDER BY f.datum DESC, f.aangemaakt DESC`;

  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/finance/:id  — Detail
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare(`
    SELECT f.*, fc.naam AS categorie_naam, fc.type AS categorie_type, i.naam AS influencer_naam
    FROM finance_items f
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    JOIN influencers i ON f.influencer_id = i.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(item);
});

// ════════════════════════════════════════════════════════════
// POST /api/finance  — Aanmaken
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const {
    influencer_id, categorie_id, type, omschrijving, bedrag,
    btw_bedrag, valuta, datum, betaald, betaald_datum,
    opdrachtgever, notities,
  } = req.body;

  if (!influencer_id || !type || !omschrijving || bedrag === undefined || !datum) {
    return res.status(400).json({ error: 'Influencer, type, omschrijving, bedrag en datum zijn verplicht' });
  }

  const result = db.prepare(`
    INSERT INTO finance_items
      (influencer_id, categorie_id, type, omschrijving, bedrag, btw_bedrag,
       valuta, datum, betaald, betaald_datum, opdrachtgever, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    influencer_id, categorie_id || null, type, omschrijving,
    parseFloat(bedrag), parseFloat(btw_bedrag || 0),
    valuta || 'EUR', datum, betaald ? 1 : 0,
    betaald_datum || null, opdrachtgever || null, notities || null
  );

  res.status(201).json(db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PUT /api/finance/:id  — Bewerken
// ════════════════════════════════════════════════════════════
router.put('/:id', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });

  const {
    categorie_id, type, omschrijving, bedrag, btw_bedrag, valuta,
    datum, betaald, betaald_datum, opdrachtgever, notities,
  } = req.body;

  db.prepare(`
    UPDATE finance_items SET
      categorie_id = ?, type = ?, omschrijving = ?, bedrag = ?, btw_bedrag = ?,
      valuta = ?, datum = ?, betaald = ?, betaald_datum = ?,
      opdrachtgever = ?, notities = ?, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    categorie_id ?? bestaand.categorie_id,
    type ?? bestaand.type,
    omschrijving ?? bestaand.omschrijving,
    bedrag !== undefined ? parseFloat(bedrag) : bestaand.bedrag,
    btw_bedrag !== undefined ? parseFloat(btw_bedrag) : bestaand.btw_bedrag,
    valuta ?? bestaand.valuta,
    datum ?? bestaand.datum,
    betaald !== undefined ? (betaald ? 1 : 0) : bestaand.betaald,
    betaald_datum ?? bestaand.betaald_datum,
    opdrachtgever ?? bestaand.opdrachtgever,
    notities ?? bestaand.notities,
    req.params.id
  );

  res.json(db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/finance/:id/betaald  — Markeer als betaald
// ════════════════════════════════════════════════════════════
router.patch('/:id/betaald', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const { betaald, betaald_datum } = req.body;

  db.prepare(`
    UPDATE finance_items SET
      betaald = ?,
      betaald_datum = ?,
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    betaald ? 1 : 0,
    betaald ? (betaald_datum || new Date().toISOString().split('T')[0]) : null,
    req.params.id
  );

  res.json(db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// POST /api/finance/:id/bestand  — Bestand uploaden
// ════════════════════════════════════════════════════════════
router.post('/:id/bestand', requireRole('pa', 'staff'), upload.single('bestand'), (req, res) => {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });

  const bestandUrl = `/uploads/finance/${req.file.filename}`;
  db.prepare(`UPDATE finance_items SET bestand_url = ?, bijgewerkt = datetime('now') WHERE id = ?`)
    .run(bestandUrl, req.params.id);

  res.json({ bestand_url: bestandUrl });
});

// ════════════════════════════════════════════════════════════
// DELETE /api/finance/:id  — Verwijderen
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('pa'), (req, res) => {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM finance_items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  db.prepare(`DELETE FROM finance_items WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
