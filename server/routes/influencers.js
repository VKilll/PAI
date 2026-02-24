const express = require('express');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/influencers
router.get('/', (req, res) => {
  const db = getDb();
  const influencers = db.prepare(`SELECT * FROM influencers ORDER BY naam`).all();
  res.json(influencers);
});

// GET /api/influencers/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const influencer = db.prepare(`SELECT * FROM influencers WHERE id = ?`).get(req.params.id);
  if (!influencer) return res.status(404).json({ error: 'Niet gevonden' });
  res.json(influencer);
});

module.exports = router;
