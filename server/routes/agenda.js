const express = require('express');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { toegestaneInfluencerIds, magInfluencerZien } = require('../middleware/scope');
const { bouwAgenda, vandaag } = require('../services/agenda');

const router = express.Router();
router.use(authenticate);

const BRON_TYPES = ['collaboration', 'content_post', 'package', 'sales_invoice', 'influencer_invoice'];

// ════════════════════════════════════════════════════════════
// GET /api/agenda  — Vandaag, achterstallig en wat eraan komt
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, dagen } = req.query;

  if (influencer_id && !magInfluencerZien(req, influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  res.json(bouwAgenda(db, {
    influencerIds: toegestaneInfluencerIds(req, db),
    influencerId: influencer_id || null,
    rol: req.user.rol,
    dagenVooruit: parseInt(dagen || '7', 10),
  }));
});

// ════════════════════════════════════════════════════════════
// GET /api/agenda/controle  — Moet de dagelijkse controle nog?
// De pop-up komt hooguit één keer per dag, en alleen als er
// daadwerkelijk iets achterstallig is.
// ════════════════════════════════════════════════════════════
router.get('/controle', (req, res) => {
  const db = getDb();

  const gedaan = db.prepare(`SELECT 1 FROM agenda_controles WHERE user_id = ? AND datum = ?`)
    .get(req.user.id, vandaag());

  const agenda = bouwAgenda(db, {
    influencerIds: toegestaneInfluencerIds(req, db),
    rol: req.user.rol,
  });

  res.json({
    nodig: !gedaan && agenda.achterstallig.length > 0,
    achterstallig: agenda.achterstallig,
  });
});

// ════════════════════════════════════════════════════════════
// POST /api/agenda/controle/klaar  — Vandaag niet meer vragen
// ════════════════════════════════════════════════════════════
router.post('/controle/klaar', (req, res) => {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO agenda_controles (user_id, datum) VALUES (?, ?)`)
    .run(req.user.id, vandaag());
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// POST /api/agenda/beslissing
// gedaan     — werkt ook het bronrecord bij waar dat kan
// vervallen  — hoeft niet meer, blijft wel vastgelegd
// verschoven — nieuwe datum, komt daar terug
// ════════════════════════════════════════════════════════════
router.post('/beslissing', (req, res) => {
  const db = getDb();
  const { bron_type, bron_id, soort, beslissing, nieuwe_datum, toelichting } = req.body;

  if (!BRON_TYPES.includes(bron_type) || !bron_id || !soort) {
    return res.status(400).json({ error: 'Onbekend agenda-item' });
  }
  if (!['gedaan', 'vervallen', 'verschoven'].includes(beslissing)) {
    return res.status(400).json({ error: 'Ongeldige beslissing' });
  }
  if (beslissing === 'verschoven' && !nieuwe_datum) {
    return res.status(400).json({ error: 'Geef een nieuwe datum op' });
  }

  // Controleren dat dit item bij een zichtbare influencer hoort
  const tabel = {
    collaboration: 'collaborations', content_post: 'content_posts', package: 'packages',
    sales_invoice: 'sales_invoices', influencer_invoice: 'influencer_invoices',
  }[bron_type];

  const bron = db.prepare(`SELECT influencer_id FROM ${tabel} WHERE id = ?`).get(bron_id);
  if (!bron) return res.status(404).json({ error: 'Item niet gevonden' });
  if (!magInfluencerZien(req, bron.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const transactie = db.transaction(() => {
    db.prepare(`
      INSERT INTO agenda_beslissingen
        (bron_type, bron_id, soort, influencer_id, beslissing, nieuwe_datum, toelichting, door)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bron_type, bron_id, soort) DO UPDATE SET
        beslissing = excluded.beslissing,
        nieuwe_datum = excluded.nieuwe_datum,
        toelichting = excluded.toelichting,
        door = excluded.door,
        aangemaakt = datetime('now')
    `).run(bron_type, bron_id, soort, bron.influencer_id, beslissing,
           nieuwe_datum || null, toelichting || null, req.user.id);

    // "Gedaan" hoort ook in het bronrecord terecht te komen
    if (beslissing === 'gedaan') {
      if (bron_type === 'collaboration' && soort === 'live') {
        db.prepare(`
          UPDATE collaborations SET status = 'gepost', gearchiveerd = 1,
            gearchiveerd_op = COALESCE(gearchiveerd_op, datetime('now')), bijgewerkt = datetime('now')
          WHERE id = ? AND status <> 'gepost'
        `).run(bron_id);
      }
      if (bron_type === 'content_post') {
        db.prepare(`
          UPDATE content_posts SET status = 'gepost',
            gepost_datum = COALESCE(gepost_datum, date('now')), bijgewerkt = datetime('now')
          WHERE id = ?
        `).run(bron_id);
      }
      if (bron_type === 'package') {
        db.prepare(`UPDATE packages SET status = 'geretourneerd', bijgewerkt = datetime('now') WHERE id = ?`)
          .run(bron_id);
      }
    }
  });

  transactie();

  res.json({
    ok: true,
    agenda: bouwAgenda(db, {
      influencerIds: toegestaneInfluencerIds(req, db),
      rol: req.user.rol,
    }),
  });
});

// ════════════════════════════════════════════════════════════
// DELETE /api/agenda/beslissing  — Beslissing terugdraaien
// ════════════════════════════════════════════════════════════
router.delete('/beslissing', (req, res) => {
  const db = getDb();
  const { bron_type, bron_id, soort } = req.body;
  db.prepare(`DELETE FROM agenda_beslissingen WHERE bron_type = ? AND bron_id = ? AND soort = ?`)
    .run(bron_type, bron_id, soort);
  res.json({ ok: true });
});

module.exports = router;
