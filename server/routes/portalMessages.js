const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { influencerFilter, magInfluencerZien } = require('../middleware/scope');
const { notificeerInfluencer } = require('../services/notificaties');

const router = express.Router();
router.use(authenticate);

const BASIS_SELECT = `
  SELECT p.*, i.naam AS influencer_naam, u.naam AS afzender_naam
  FROM portal_messages p
  JOIN influencers i ON p.influencer_id = i.id
  LEFT JOIN users u ON p.van_user_id = u.id
`;

// ════════════════════════════════════════════════════════════
// GET /api/portal-messages
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, ongelezen } = req.query;

  let sql = `${BASIS_SELECT} WHERE 1=1`;
  const params = [];

  if (influencer_id)      { sql += ` AND p.influencer_id = ?`; params.push(influencer_id); }
  if (ongelezen === 'true') sql += ` AND p.gelezen = 0`;

  const scope = influencerFilter(req, 'p.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY p.aangemaakt DESC`;
  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// POST /api/portal-messages  — Manager stuurt een bericht naar de influencer
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('manager', 'pa'), (req, res) => {
  const db = getDb();
  const { influencer_id, onderwerp, bericht, type, sales_invoice_id, collaboration_id } = req.body;

  if (!influencer_id || !onderwerp || !bericht) {
    return res.status(400).json({ error: 'Influencer, onderwerp en bericht zijn verplicht' });
  }

  const result = db.prepare(`
    INSERT INTO portal_messages
      (influencer_id, van_user_id, type, onderwerp, bericht, sales_invoice_id, collaboration_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    influencer_id, req.user.id, type || 'algemeen', onderwerp, bericht,
    sales_invoice_id || null, collaboration_id || null
  );

  notificeerInfluencer(influencer_id, {
    type: 'portaal_bericht',
    titel: onderwerp,
    bericht,
    entiteit_type: 'portal_message',
    entiteit_id: result.lastInsertRowid,
    link: '/berichten',
  }, db);

  res.status(201).json(db.prepare(`${BASIS_SELECT} WHERE p.id = ?`).get(result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/portal-messages/:id/gelezen
// ════════════════════════════════════════════════════════════
router.patch('/:id/gelezen', (req, res) => {
  const db = getDb();
  const bericht = db.prepare(`SELECT * FROM portal_messages WHERE id = ?`).get(req.params.id);
  if (!bericht) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, bericht.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  db.prepare(`UPDATE portal_messages SET gelezen = 1, gelezen_op = datetime('now') WHERE id = ?`)
    .run(req.params.id);

  res.json(db.prepare(`${BASIS_SELECT} WHERE p.id = ?`).get(req.params.id));
});

module.exports = router;
