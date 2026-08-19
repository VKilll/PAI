const express = require('express');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Een notificatie is voor mij als hij op mijn rol staat of op mijn gebruiker
const VOOR_MIJ = `(doel_user_id = ? OR (doel_user_id IS NULL AND doel_rol = ?))`;

// ════════════════════════════════════════════════════════════
// GET /api/notifications  — ?ongelezen=true / ?open=true
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { ongelezen, open, limiet } = req.query;

  let sql = `SELECT * FROM notifications WHERE ${VOOR_MIJ}`;
  const params = [req.user.id, req.user.rol];

  if (ongelezen === 'true') sql += ` AND gelezen = 0`;
  if (open === 'true')      sql += ` AND afgehandeld = 0`;

  sql += ` ORDER BY aangemaakt DESC LIMIT ?`;
  params.push(parseInt(limiet || '50', 10));

  const items = db.prepare(sql).all(...params);

  const telling = db.prepare(
    `SELECT COUNT(*) AS n FROM notifications WHERE ${VOOR_MIJ} AND gelezen = 0`
  ).get(req.user.id, req.user.rol);

  res.json({ items, ongelezen: telling.n });
});

// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/gelezen
// ════════════════════════════════════════════════════════════
router.patch('/:id/gelezen', (req, res) => {
  const db = getDb();
  const resultaat = db.prepare(`
    UPDATE notifications SET gelezen = 1, gelezen_op = datetime('now')
    WHERE id = ? AND ${VOOR_MIJ}
  `).run(req.params.id, req.user.id, req.user.rol);

  if (resultaat.changes === 0) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/afgehandeld
// ════════════════════════════════════════════════════════════
router.patch('/:id/afgehandeld', (req, res) => {
  const db = getDb();
  const resultaat = db.prepare(`
    UPDATE notifications SET
      gelezen = 1, gelezen_op = COALESCE(gelezen_op, datetime('now')),
      afgehandeld = 1, afgehandeld_op = datetime('now')
    WHERE id = ? AND ${VOOR_MIJ}
  `).run(req.params.id, req.user.id, req.user.rol);

  if (resultaat.changes === 0) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// POST /api/notifications/alles-gelezen
// ════════════════════════════════════════════════════════════
router.post('/alles-gelezen', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE notifications SET gelezen = 1, gelezen_op = datetime('now')
    WHERE gelezen = 0 AND ${VOOR_MIJ}
  `).run(req.user.id, req.user.rol);
  res.json({ ok: true });
});

module.exports = router;
