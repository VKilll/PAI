const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── Multer configuratie ───────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/packages');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const opslag = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const uniek = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${uniek}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage: opslag,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const toegestaan = /jpeg|jpg|png|webp|gif/.test(file.mimetype);
    cb(null, toegestaan);
  },
});

// ── Helper: sla statuswijziging op ───────────────────────────
function logStatusWijziging(db, packageId, vanStatus, naarStatus, notitie, userId) {
  db.prepare(`
    INSERT INTO package_status_history (package_id, van_status, naar_status, notitie, gewijzigd_door)
    VALUES (?, ?, ?, ?, ?)
  `).run(packageId, vanStatus, naarStatus, notitie || null, userId || null);
}

// ════════════════════════════════════════════════════════════
// GET /api/packages  — Overzicht
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { status, influencer_id, zoek } = req.query;

  let sql = `
    SELECT
      p.*,
      i.naam AS influencer_naam,
      i.gebruikersnaam AS influencer_handle,
      (SELECT COUNT(*) FROM package_items pi WHERE pi.package_id = p.id) AS aantal_items
    FROM packages p
    JOIN influencers i ON p.influencer_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (status)        { sql += ` AND p.status = ?`;           params.push(status); }
  if (influencer_id) { sql += ` AND p.influencer_id = ?`;    params.push(influencer_id); }
  if (zoek)          { sql += ` AND (p.merk LIKE ? OR p.omschrijving LIKE ? OR p.tracking_nummer LIKE ?)`; params.push(`%${zoek}%`, `%${zoek}%`, `%${zoek}%`); }

  sql += ` ORDER BY p.aangemaakt DESC`;

  const pakketten = db.prepare(sql).all(...params);
  res.json(pakketten);
});

// ════════════════════════════════════════════════════════════
// GET /api/packages/:id  — Detail
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();

  const pakket = db.prepare(`
    SELECT p.*, i.naam AS influencer_naam, i.gebruikersnaam AS influencer_handle
    FROM packages p
    JOIN influencers i ON p.influencer_id = i.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!pakket) return res.status(404).json({ error: 'Pakket niet gevonden' });

  const items = db.prepare(`SELECT * FROM package_items WHERE package_id = ? ORDER BY id`).all(req.params.id);
  const geschiedenis = db.prepare(`
    SELECT h.*, u.naam AS gewijzigd_door_naam
    FROM package_status_history h
    LEFT JOIN users u ON h.gewijzigd_door = u.id
    WHERE h.package_id = ?
    ORDER BY h.aangemaakt DESC
  `).all(req.params.id);

  res.json({ ...pakket, items, geschiedenis });
});

// ════════════════════════════════════════════════════════════
// POST /api/packages  — Aanmaken
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const {
    influencer_id, merk, omschrijving, tracking_nummer, vervoerder,
    verwachte_datum, retour_vereist, retour_deadline, notities,
  } = req.body;

  if (!influencer_id || !merk) {
    return res.status(400).json({ error: 'Influencer en merk zijn verplicht' });
  }

  const result = db.prepare(`
    INSERT INTO packages
      (influencer_id, merk, omschrijving, tracking_nummer, vervoerder,
       verwachte_datum, status, retour_vereist, retour_deadline, notities)
    VALUES (?, ?, ?, ?, ?, ?, 'verwacht', ?, ?, ?)
  `).run(
    influencer_id, merk, omschrijving || null, tracking_nummer || null,
    vervoerder || null, verwachte_datum || null,
    retour_vereist ? 1 : 0, retour_deadline || null, notities || null
  );

  logStatusWijziging(db, result.lastInsertRowid, null, 'verwacht', 'Pakket aangemaakt', req.user.id);

  const pakket = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(pakket);
});

// ════════════════════════════════════════════════════════════
// PUT /api/packages/:id  — Bewerken
// ════════════════════════════════════════════════════════════
router.put('/:id', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Pakket niet gevonden' });

  const {
    merk, omschrijving, tracking_nummer, vervoerder,
    verwachte_datum, ontvangen_datum, retour_vereist,
    retour_deadline, retour_beleid, retour_beleid_bron, notities,
  } = req.body;

  db.prepare(`
    UPDATE packages SET
      merk = ?, omschrijving = ?, tracking_nummer = ?, vervoerder = ?,
      verwachte_datum = ?, ontvangen_datum = ?, retour_vereist = ?,
      retour_deadline = ?, retour_beleid = ?, retour_beleid_bron = ?,
      notities = ?, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    merk ?? bestaand.merk,
    omschrijving ?? bestaand.omschrijving,
    tracking_nummer ?? bestaand.tracking_nummer,
    vervoerder ?? bestaand.vervoerder,
    verwachte_datum ?? bestaand.verwachte_datum,
    ontvangen_datum ?? bestaand.ontvangen_datum,
    retour_vereist !== undefined ? (retour_vereist ? 1 : 0) : bestaand.retour_vereist,
    retour_deadline ?? bestaand.retour_deadline,
    retour_beleid ?? bestaand.retour_beleid,
    retour_beleid_bron ?? bestaand.retour_beleid_bron,
    notities ?? bestaand.notities,
    req.params.id
  );

  res.json(db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/packages/:id/status  — Status wijzigen
// ════════════════════════════════════════════════════════════
router.patch('/:id/status', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const { status, notitie } = req.body;

  const geldig = ['verwacht','ontvangen','geopend','verwerkt','retour_aangemeld','geretourneerd','afgerond'];
  if (!geldig.includes(status)) {
    return res.status(400).json({ error: 'Ongeldige status' });
  }

  const bestaand = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Pakket niet gevonden' });

  db.prepare(`
    UPDATE packages SET
      status = ?,
      ontvangen_datum = CASE WHEN ? = 'ontvangen' AND ontvangen_datum IS NULL THEN date('now') ELSE ontvangen_datum END,
      bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(status, status, req.params.id);

  logStatusWijziging(db, req.params.id, bestaand.status, status, notitie, req.user.id);

  res.json(db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// POST /api/packages/:id/fotos  — Foto's uploaden
// ════════════════════════════════════════════════════════════
router.post('/:id/fotos', requireRole('pa', 'staff'), upload.array('fotos', 10), (req, res) => {
  const db = getDb();
  const pakket = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id);
  if (!pakket) return res.status(404).json({ error: 'Pakket niet gevonden' });

  const bestaandeFotos = pakket.foto_urls ? JSON.parse(pakket.foto_urls) : [];
  const nieuweFotos = req.files.map(f => `/uploads/packages/${f.filename}`);
  const alleFotos = [...bestaandeFotos, ...nieuweFotos];

  db.prepare(`UPDATE packages SET foto_urls = ?, bijgewerkt = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(alleFotos), req.params.id);

  res.json({ foto_urls: alleFotos });
});

// ════════════════════════════════════════════════════════════
// POST /api/packages/:id/items  — Item toevoegen
// ════════════════════════════════════════════════════════════
router.post('/:id/items', requireRole('pa', 'staff'), (req, res) => {
  const db = getDb();
  const { naam, categorie, merk, maat, kleur, waarde, notities } = req.body;

  if (!naam) return res.status(400).json({ error: 'Naam is verplicht' });

  const result = db.prepare(`
    INSERT INTO package_items (package_id, naam, categorie, merk, maat, kleur, waarde, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, naam, categorie || null, merk || null, maat || null, kleur || null, waarde || null, notities || null);

  res.status(201).json(db.prepare(`SELECT * FROM package_items WHERE id = ?`).get(result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// DELETE /api/packages/:id/items/:itemId  — Item verwijderen
// ════════════════════════════════════════════════════════════
router.delete('/:id/items/:itemId', requireRole('pa'), (req, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM package_items WHERE id = ? AND package_id = ?`)
    .run(req.params.itemId, req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// POST /api/packages/:id/retour-beleid  — AI retourbeleid ophalen
// ════════════════════════════════════════════════════════════
router.post('/:id/retour-beleid', requireRole('pa', 'staff'), async (req, res) => {
  const db = getDb();
  const pakket = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id);
  if (!pakket) return res.status(404).json({ error: 'Pakket niet gevonden' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd in .env' });
  }

  try {
    const prompt = `Je bent assistent voor een influencer PA. Geef het retourbeleid voor het merk "${pakket.merk}" in het Nederlands.

Geef een beknopt overzicht (max 150 woorden) met:
- Retourperiode (hoeveel dagen)
- Hoe retour aanmelden (online/post/winkel)
- Voorwaarden (ongedragen, labels, etc.)
- Retourkosten (gratis of niet)

Geef ook de website van het merk als bron.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API fout: ${response.status}`);

    const data = await response.json();
    const beleid = data.content[0].text;
    const bron = `Claude AI — ${new Date().toLocaleDateString('nl-NL')}`;

    db.prepare(`
      UPDATE packages SET retour_beleid = ?, retour_beleid_bron = ?, bijgewerkt = datetime('now')
      WHERE id = ?
    `).run(beleid, bron, req.params.id);

    res.json({ retour_beleid: beleid, bron });

  } catch (err) {
    console.error('AI retourbeleid fout:', err);
    res.status(500).json({ error: 'Kon retourbeleid niet ophalen. Probeer opnieuw.' });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/packages/:id  — Verwijderen
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('pa'), (req, res) => {
  const db = getDb();
  const pakket = db.prepare(`SELECT * FROM packages WHERE id = ?`).get(req.params.id);
  if (!pakket) return res.status(404).json({ error: 'Pakket niet gevonden' });

  db.prepare(`DELETE FROM packages WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
