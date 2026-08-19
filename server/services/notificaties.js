const { getDb } = require('../database/db');

// ============================================================
// Notificaties — voeden de pop-ups in het portaal
// ============================================================

/**
 * Maakt één notificatie aan voor een rol (bijv. alle managers) of voor één gebruiker.
 */
function maakNotificatie({
  doel_rol = null, doel_user_id = null, type, titel, bericht = null,
  entiteit_type = null, entiteit_id = null, link = null, prioriteit = 'normaal',
}, db = getDb()) {
  const result = db.prepare(`
    INSERT INTO notifications
      (doel_rol, doel_user_id, type, titel, bericht, entiteit_type, entiteit_id, link, prioriteit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(doel_rol, doel_user_id, type, titel, bericht, entiteit_type, entiteit_id, link, prioriteit);

  return db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(result.lastInsertRowid);
}

/**
 * Zelfde notificatie voor meerdere rollen tegelijk (bijv. ['pa', 'influencer']).
 */
function notificeerRollen(rollen, payload, db = getDb()) {
  return rollen.map(rol => maakNotificatie({ ...payload, doel_rol: rol }, db));
}

/**
 * Notificatie voor de gebruiker die aan een influencer hangt (het influencer-portaal).
 */
function notificeerInfluencer(influencerId, payload, db = getDb()) {
  const influencer = db.prepare(`SELECT user_id FROM influencers WHERE id = ?`).get(influencerId);
  if (!influencer?.user_id) return null;
  return maakNotificatie({ ...payload, doel_user_id: influencer.user_id }, db);
}

module.exports = { maakNotificatie, notificeerRollen, notificeerInfluencer };
