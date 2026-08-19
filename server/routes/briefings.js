const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { influencerFilter, magInfluencerZien } = require('../middleware/scope');
const briefingAI = require('../services/briefingAI');

const router = express.Router();
router.use(authenticate);

// ── Uploads ───────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/briefings');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniek = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${uniek}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const toegestaan = /pdf|text\/plain|markdown|csv/.test(file.mimetype);
    cb(toegestaan ? null : new Error('Alleen PDF- of tekstbestanden'), toegestaan);
  },
});

const BASIS_SELECT = `
  SELECT b.*, i.naam AS influencer_naam,
         c.id AS samenwerking_id, c.titel AS samenwerking_titel, c.klant AS samenwerking_klant
  FROM briefings b
  JOIN influencers i ON b.influencer_id = i.id
  LEFT JOIN collaborations c ON c.briefing_id = b.id
`;

function haal(db, id) {
  const briefing = db.prepare(`${BASIS_SELECT} WHERE b.id = ?`).get(id);
  if (!briefing) return null;
  briefing.deliverables = db.prepare(
    `SELECT * FROM briefing_deliverables WHERE briefing_id = ? ORDER BY id`
  ).all(id);
  return briefing;
}

/** Slaat de uitgelezen velden op en zet de deliverables klaar. */
function bewaarExtractie(db, briefingId, extractie, status, fout) {
  db.prepare(`
    UPDATE briefings SET
      ai_samenvatting = COALESCE(?, ai_samenvatting),
      live_datum      = COALESCE(?, live_datum),
      deadline        = COALESCE(?, deadline),
      vergoeding      = COALESCE(?, vergoeding),
      hashtags        = ?,
      vermeldingen    = ?,
      exclusiviteit   = COALESCE(?, exclusiviteit),
      ai_extractie    = ?,
      ai_status       = ?,
      ai_fout         = ?,
      status          = CASE WHEN status = 'nieuw' THEN 'verwerkt' ELSE status END,
      bijgewerkt      = datetime('now')
    WHERE id = ?
  `).run(
    extractie?.samenvatting || null,
    extractie?.live_datum || null,
    extractie?.deadline || null,
    extractie?.vergoeding ?? null,
    JSON.stringify(extractie?.hashtags || []),
    JSON.stringify(extractie?.vermeldingen || []),
    extractie?.exclusiviteit || null,
    extractie ? JSON.stringify(extractie) : null,
    status,
    fout || null,
    briefingId
  );

  // Deliverables opnieuw opbouwen uit de uitlezing
  if (extractie?.deliverables?.length) {
    db.prepare(`DELETE FROM briefing_deliverables WHERE briefing_id = ? AND afgerond = 0`).run(briefingId);
    const invoegen = db.prepare(`
      INSERT INTO briefing_deliverables (briefing_id, omschrijving, platform, deadline)
      VALUES (?, ?, ?, ?)
    `);
    for (const d of extractie.deliverables) {
      const omschrijving = d.aantal && d.aantal > 1 ? `${d.aantal}× ${d.omschrijving}` : d.omschrijving;
      invoegen.run(briefingId, omschrijving, d.platform || null, d.deadline || null);
    }
  }
}

// ════════════════════════════════════════════════════════════
// GET /api/briefings
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, status, zoek } = req.query;

  let sql = `${BASIS_SELECT} WHERE 1=1`;
  const params = [];

  if (influencer_id) { sql += ` AND b.influencer_id = ?`; params.push(influencer_id); }
  if (status)        { sql += ` AND b.status = ?`;        params.push(status); }
  if (zoek) {
    sql += ` AND (b.titel LIKE ? OR b.opdrachtgever LIKE ?)`;
    params.push(`%${zoek}%`, `%${zoek}%`);
  }

  const scope = influencerFilter(req, 'b.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY COALESCE(b.live_datum, b.deadline, b.ontvangen_datum) DESC, b.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/briefings/:id
// ════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const db = getDb();
  const briefing = haal(db, req.params.id);
  if (!briefing) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, briefing.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  res.json(briefing);
});

// ════════════════════════════════════════════════════════════
// POST /api/briefings  — Aanmaken met geplakte tekst
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('manager', 'pa', 'staff'), async (req, res) => {
  const db = getDb();
  const { influencer_id, opdrachtgever, titel, ruwe_tekst, collaboration_id, uitlezen = true } = req.body;

  if (!influencer_id || !opdrachtgever || !titel) {
    return res.status(400).json({ error: 'Influencer, opdrachtgever en titel zijn verplicht' });
  }

  const result = db.prepare(`
    INSERT INTO briefings (influencer_id, opdrachtgever, titel, ruwe_tekst, bestand_type)
    VALUES (?, ?, ?, ?, 'tekst')
  `).run(influencer_id, opdrachtgever, titel, ruwe_tekst || null);

  const briefingId = result.lastInsertRowid;
  if (collaboration_id) koppel(db, briefingId, collaboration_id);

  if (uitlezen && ruwe_tekst) {
    const { extractie, status, fout } = await briefingAI.extraheer(ruwe_tekst);
    bewaarExtractie(db, briefingId, extractie, status, fout);
  }

  res.status(201).json(haal(db, briefingId));
});

// ════════════════════════════════════════════════════════════
// POST /api/briefings/upload  — PDF of tekstbestand
// ════════════════════════════════════════════════════════════
router.post('/upload', requireRole('manager', 'pa', 'staff'), upload.single('bestand'), async (req, res) => {
  const db = getDb();
  const { influencer_id, opdrachtgever, titel, collaboration_id } = req.body;

  if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
  if (!influencer_id) return res.status(400).json({ error: 'Kies een influencer' });

  let tekst = '';
  try {
    tekst = await briefingAI.leesTekst(req.file.path, req.file.mimetype);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const result = db.prepare(`
    INSERT INTO briefings
      (influencer_id, opdrachtgever, titel, origineel_bestand, bestand_type, ruwe_tekst)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    influencer_id,
    opdrachtgever || 'Onbekend',
    titel || req.file.originalname.replace(/\.[^.]+$/, ''),
    `/uploads/briefings/${req.file.filename}`,
    path.extname(req.file.originalname).replace('.', '') || 'pdf',
    tekst
  );

  const briefingId = result.lastInsertRowid;
  if (collaboration_id) koppel(db, briefingId, collaboration_id);

  const { extractie, status, fout } = await briefingAI.extraheer(tekst);
  bewaarExtractie(db, briefingId, extractie, status, fout);

  res.status(201).json(haal(db, briefingId));
});

// ════════════════════════════════════════════════════════════
// POST /api/briefings/:id/uitlezen  — Opnieuw door de AI halen
// ════════════════════════════════════════════════════════════
router.post('/:id/uitlezen', requireRole('manager', 'pa', 'staff'), async (req, res) => {
  const db = getDb();
  const briefing = db.prepare(`SELECT * FROM briefings WHERE id = ?`).get(req.params.id);
  if (!briefing) return res.status(404).json({ error: 'Niet gevonden' });

  const tekst = req.body.ruwe_tekst || briefing.ruwe_tekst;
  if (!tekst) return res.status(400).json({ error: 'Er is geen tekst om uit te lezen' });

  if (req.body.ruwe_tekst) {
    db.prepare(`UPDATE briefings SET ruwe_tekst = ?, bijgewerkt = datetime('now') WHERE id = ?`)
      .run(req.body.ruwe_tekst, req.params.id);
  }

  const { extractie, status, fout } = await briefingAI.extraheer(tekst);
  bewaarExtractie(db, req.params.id, extractie, status, fout);

  const resultaat = haal(db, req.params.id);
  if (status === 'mislukt') return res.status(502).json({ briefing: resultaat, error: fout });
  res.json({ briefing: resultaat, ai_status: status, waarschuwing: fout || null });
});

// ── Koppelen aan een samenwerking ─────────────────────────────
function koppel(db, briefingId, collaborationId) {
  db.prepare(`UPDATE collaborations SET briefing_id = NULL WHERE briefing_id = ?`).run(briefingId);
  db.prepare(`UPDATE collaborations SET briefing_id = ?, bijgewerkt = datetime('now') WHERE id = ?`)
    .run(briefingId, collaborationId);
}

// ════════════════════════════════════════════════════════════
// POST /api/briefings/:id/koppel  — Ook achteraf nog te doen
// ════════════════════════════════════════════════════════════
router.post('/:id/koppel', requireRole('manager', 'pa', 'staff'), (req, res) => {
  const db = getDb();
  const { collaboration_id } = req.body;

  const briefing = db.prepare(`SELECT * FROM briefings WHERE id = ?`).get(req.params.id);
  if (!briefing) return res.status(404).json({ error: 'Briefing niet gevonden' });

  if (!collaboration_id) {
    db.prepare(`UPDATE collaborations SET briefing_id = NULL WHERE briefing_id = ?`).run(req.params.id);
    return res.json(haal(db, req.params.id));
  }

  const samenwerking = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(collaboration_id);
  if (!samenwerking) return res.status(404).json({ error: 'Samenwerking niet gevonden' });
  if (samenwerking.influencer_id !== briefing.influencer_id) {
    return res.status(409).json({ error: 'Deze samenwerking is van een andere influencer' });
  }

  koppel(db, req.params.id, collaboration_id);

  // Livedatum uit de briefing overnemen als de samenwerking er nog geen heeft
  if (briefing.live_datum && !samenwerking.post_datum) {
    db.prepare(`UPDATE collaborations SET post_datum = ?, bijgewerkt = datetime('now') WHERE id = ?`)
      .run(briefing.live_datum, collaboration_id);
  }

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// PUT /api/briefings/:id  — Handmatig bijstellen
// ════════════════════════════════════════════════════════════
router.put('/:id', requireRole('manager', 'pa', 'staff'), (req, res) => {
  const db = getDb();
  const bestaand = db.prepare(`SELECT * FROM briefings WHERE id = ?`).get(req.params.id);
  if (!bestaand) return res.status(404).json({ error: 'Niet gevonden' });

  const velden = ['opdrachtgever', 'titel', 'status', 'deadline', 'live_datum',
                  'vergoeding', 'exclusiviteit', 'ai_samenvatting', 'notities'];
  const waarden = velden.map(v => (req.body[v] !== undefined ? req.body[v] : bestaand[v]));

  db.prepare(`
    UPDATE briefings SET ${velden.map(v => `${v} = ?`).join(', ')},
      hashtags = ?, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(
    ...waarden,
    req.body.hashtags !== undefined ? JSON.stringify(req.body.hashtags) : bestaand.hashtags,
    req.params.id
  );

  res.json(haal(db, req.params.id));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/briefings/deliverables/:id  — Afvinken
// ════════════════════════════════════════════════════════════
router.patch('/deliverables/:id', requireRole('manager', 'pa', 'staff', 'influencer'), (req, res) => {
  const db = getDb();
  const { afgerond } = req.body;
  db.prepare(`
    UPDATE briefing_deliverables SET afgerond = ?, afgerond_op = ? WHERE id = ?
  `).run(afgerond ? 1 : 0, afgerond ? new Date().toISOString().split('T')[0] : null, req.params.id);
  res.json(db.prepare(`SELECT * FROM briefing_deliverables WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// DELETE /api/briefings/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('manager', 'pa'), (req, res) => {
  const db = getDb();
  const briefing = db.prepare(`SELECT * FROM briefings WHERE id = ?`).get(req.params.id);
  if (!briefing) return res.status(404).json({ error: 'Niet gevonden' });

  const transactie = db.transaction(() => {
    db.prepare(`UPDATE collaborations SET briefing_id = NULL WHERE briefing_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM briefing_deliverables WHERE briefing_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM briefing_reminders WHERE briefing_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM briefings WHERE id = ?`).run(req.params.id);
  });
  transactie();

  res.json({ ok: true });
});

module.exports = router;
