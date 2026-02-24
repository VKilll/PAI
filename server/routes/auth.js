const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, wachtwoord } = req.body;
  if (!email || !wachtwoord) {
    return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
  }

  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE email = ? AND actief = 1`).get(email);

  if (!user || !bcrypt.compareSync(wachtwoord, user.wachtwoord)) {
    return res.status(401).json({ error: 'Onjuiste inloggegevens' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, naam: user.naam },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  res.json({
    token,
    gebruiker: { id: user.id, naam: user.naam, email: user.email, rol: user.rol }
  });
});

// GET /api/auth/mij
router.get('/mij', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`SELECT id, naam, email, rol FROM users WHERE id = ?`).get(req.user.id);
  res.json(user);
});

module.exports = router;
