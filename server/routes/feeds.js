const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { influencerFilter, magInfluencerZien } = require('../middleware/scope');
const instagram = require('../services/instagram');

const router = express.Router();
router.use(authenticate);

// ════════════════════════════════════════════════════════════
// GET /api/feeds  — Feed-items, nieuwste eerst
// ════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const db = getDb();
  const { influencer_id, limiet } = req.query;

  let sql = `
    SELECT f.*, i.naam AS influencer_naam, c.titel AS samenwerking_titel, c.klant
    FROM feed_items f
    JOIN influencers i ON f.influencer_id = i.id
    LEFT JOIN collaborations c ON f.collaboration_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (influencer_id) { sql += ` AND f.influencer_id = ?`; params.push(influencer_id); }

  const scope = influencerFilter(req, 'f.influencer_id', db);
  sql += scope.sql;
  params.push(...scope.params);

  sql += ` ORDER BY COALESCE(f.gepost_op, f.aangemaakt) DESC, f.id DESC LIMIT ?`;
  params.push(parseInt(limiet || '60', 10));

  res.json(db.prepare(sql).all(...params));
});

// ════════════════════════════════════════════════════════════
// GET /api/feeds/accounts  — Koppelstatus per influencer
// ════════════════════════════════════════════════════════════
router.get('/accounts', (req, res) => {
  const db = getDb();

  let sql = `
    SELECT i.id AS influencer_id, i.naam AS influencer_naam, i.gebruikersnaam,
           a.id AS account_id, a.gebruikersnaam AS ig_gebruikersnaam, a.status,
           a.laatste_sync, a.laatste_fout, a.token_verloopt,
           (SELECT COUNT(*) FROM feed_items f WHERE f.influencer_id = i.id) AS aantal_posts
    FROM influencers i
    LEFT JOIN instagram_accounts a ON a.influencer_id = i.id
    WHERE 1=1
  `;
  const params = [];
  const scope = influencerFilter(req, 'i.id', db);
  sql += scope.sql;
  params.push(...scope.params);
  sql += ` ORDER BY i.naam`;

  res.json({
    accounts: db.prepare(sql).all(...params),
    meta_geconfigureerd: instagram.isGeconfigureerd(),
  });
});

// ════════════════════════════════════════════════════════════
// POST /api/feeds/:influencerId/koppel  — Instagram koppelen
// Je plakt hier een token uit de Meta-app; die wordt omgezet naar een
// long-lived token en het bijbehorende Business-account wordt opgezocht.
// ════════════════════════════════════════════════════════════
router.post('/:influencerId/koppel', requireRole('pa', 'manager', 'influencer'), async (req, res) => {
  const db = getDb();
  const { influencerId } = req.params;
  const { token, al_verlengd } = req.body;

  if (!magInfluencerZien(req, influencerId, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  if (!token) return res.status(400).json({ error: 'Geef een toegangstoken op' });

  try {
    const lang = al_verlengd
      ? { token, verloopt: null }
      : await instagram.verlengToken(token);

    const account = await instagram.zoekAccount(lang.token);

    db.prepare(`
      INSERT INTO instagram_accounts
        (influencer_id, ig_gebruiker_id, gebruikersnaam, pagina_id, toegangstoken, token_verloopt, status, laatste_fout)
      VALUES (?, ?, ?, ?, ?, ?, 'gekoppeld', NULL)
      ON CONFLICT(influencer_id) DO UPDATE SET
        ig_gebruiker_id = excluded.ig_gebruiker_id,
        gebruikersnaam  = excluded.gebruikersnaam,
        pagina_id       = excluded.pagina_id,
        toegangstoken   = excluded.toegangstoken,
        token_verloopt  = excluded.token_verloopt,
        status = 'gekoppeld', laatste_fout = NULL, bijgewerkt = datetime('now')
    `).run(influencerId, account.ig_gebruiker_id, account.gebruikersnaam,
           account.pagina_id, lang.token, lang.verloopt);

    res.json({ ok: true, account: { ...account, token_verloopt: lang.verloopt } });
  } catch (err) {
    db.prepare(`
      INSERT INTO instagram_accounts (influencer_id, status, laatste_fout)
      VALUES (?, 'fout', ?)
      ON CONFLICT(influencer_id) DO UPDATE SET
        status = 'fout', laatste_fout = excluded.laatste_fout, bijgewerkt = datetime('now')
    `).run(influencerId, err.message);

    res.status(400).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/feeds/:influencerId/sync  — Feed ophalen bij Instagram
// ════════════════════════════════════════════════════════════
router.post('/:influencerId/sync', async (req, res) => {
  const db = getDb();
  const { influencerId } = req.params;

  if (!magInfluencerZien(req, influencerId, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const account = db.prepare(`SELECT * FROM instagram_accounts WHERE influencer_id = ?`).get(influencerId);
  if (!account || account.status !== 'gekoppeld') {
    return res.status(409).json({ error: 'Deze influencer heeft nog geen werkende Instagram-koppeling' });
  }

  try {
    const posts = await instagram.haalFeed(account);

    const invoegen = db.prepare(`
      INSERT INTO feed_items
        (influencer_id, bron, externe_id, media_type, permalink, media_url, thumbnail_url,
         caption, hashtags, gepost_op, likes, reacties)
      VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(influencer_id, bron, externe_id) DO UPDATE SET
        caption = excluded.caption, hashtags = excluded.hashtags,
        media_url = excluded.media_url, thumbnail_url = excluded.thumbnail_url,
        likes = excluded.likes, reacties = excluded.reacties, bijgewerkt = datetime('now')
    `);

    const opslaan = db.transaction(() => {
      for (const p of posts) {
        invoegen.run(influencerId, p.externe_id, p.media_type, p.permalink, p.media_url,
                     p.thumbnail_url, p.caption, p.hashtags, p.gepost_op, p.likes, p.reacties);
      }
      db.prepare(`
        UPDATE instagram_accounts SET laatste_sync = datetime('now'), laatste_fout = NULL,
          status = 'gekoppeld', bijgewerkt = datetime('now')
        WHERE influencer_id = ?
      `).run(influencerId);
    });
    opslaan();

    res.json({ ok: true, opgehaald: posts.length });
  } catch (err) {
    // Een verlopen token verdient een eigen status, want dat los je anders op
    const verlopen = err.code === 190;
    db.prepare(`
      UPDATE instagram_accounts SET status = ?, laatste_fout = ?, bijgewerkt = datetime('now')
      WHERE influencer_id = ?
    `).run(verlopen ? 'token_verlopen' : 'fout', err.message, influencerId);

    res.status(502).json({
      error: verlopen
        ? 'Het Instagram-token is verlopen. Koppel het account opnieuw.'
        : `Ophalen bij Instagram mislukt: ${err.message}`,
    });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/feeds/:influencerId/koppel  — Koppeling verbreken
// ════════════════════════════════════════════════════════════
router.delete('/:influencerId/koppel', requireRole('pa', 'manager', 'influencer'), (req, res) => {
  const db = getDb();
  if (!magInfluencerZien(req, req.params.influencerId, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  db.prepare(`DELETE FROM instagram_accounts WHERE influencer_id = ?`).run(req.params.influencerId);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// POST /api/feeds  — Handmatig een post toevoegen
// ════════════════════════════════════════════════════════════
router.post('/', requireRole('pa', 'manager', 'staff', 'influencer'), (req, res) => {
  const db = getDb();
  const {
    influencer_id, media_type, permalink, media_url, thumbnail_url,
    caption, gepost_op, likes, reacties, bereik, weergaven, collaboration_id, notities,
  } = req.body;

  if (!influencer_id) return res.status(400).json({ error: 'Kies een influencer' });
  if (!magInfluencerZien(req, influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const result = db.prepare(`
    INSERT INTO feed_items
      (influencer_id, bron, media_type, permalink, media_url, thumbnail_url, caption,
       hashtags, gepost_op, likes, reacties, bereik, weergaven, collaboration_id, notities)
    VALUES (?, 'handmatig', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    influencer_id, media_type || 'IMAGE', permalink || null, media_url || null,
    thumbnail_url || media_url || null, caption || null,
    JSON.stringify(instagram.haalHashtags(caption)),
    gepost_op || new Date().toISOString().split('T')[0],
    likes ?? null, reacties ?? null, bereik ?? null, weergaven ?? null,
    collaboration_id || null, notities || null
  );

  res.status(201).json(db.prepare(`SELECT * FROM feed_items WHERE id = ?`).get(result.lastInsertRowid));
});

// ════════════════════════════════════════════════════════════
// PATCH /api/feeds/:id  — Aan een samenwerking hangen of cijfers bijwerken
// ════════════════════════════════════════════════════════════
router.patch('/:id', requireRole('pa', 'manager', 'staff', 'influencer'), (req, res) => {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM feed_items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, item.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }

  const velden = ['collaboration_id', 'likes', 'reacties', 'bereik', 'weergaven', 'notities'];
  const waarden = velden.map(v => (req.body[v] !== undefined ? req.body[v] : item[v]));

  db.prepare(`
    UPDATE feed_items SET ${velden.map(v => `${v} = ?`).join(', ')}, bijgewerkt = datetime('now')
    WHERE id = ?
  `).run(...waarden, req.params.id);

  res.json(db.prepare(`SELECT * FROM feed_items WHERE id = ?`).get(req.params.id));
});

// ════════════════════════════════════════════════════════════
// DELETE /api/feeds/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', requireRole('pa', 'manager', 'staff', 'influencer'), (req, res) => {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM feed_items WHERE id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  if (!magInfluencerZien(req, item.influencer_id, db)) {
    return res.status(403).json({ error: 'Onvoldoende rechten' });
  }
  db.prepare(`DELETE FROM feed_items WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
