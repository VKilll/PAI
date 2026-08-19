const { getDb } = require('../database/db');

// ============================================================
// Influencer-scope
// PA, manager en staff zien álle influencers en kunnen wisselen met de
// influencer-switch. Een influencer ziet uitsluitend het eigen dossier.
// ============================================================

const ALLE_INFLUENCERS_ROLLEN = ['pa', 'manager', 'staff'];

function eigenInfluencerIds(userId, db = getDb()) {
  return db.prepare(`SELECT id FROM influencers WHERE user_id = ?`).all(userId).map(r => r.id);
}

/**
 * @returns {number[]|null} null = geen beperking (alle influencers)
 */
function toegestaneInfluencerIds(req, db = getDb()) {
  if (ALLE_INFLUENCERS_ROLLEN.includes(req.user?.rol)) return null;
  return eigenInfluencerIds(req.user.id, db);
}

/**
 * Bouwt een WHERE-fragment dat de query beperkt tot de zichtbare influencers.
 * @returns {{sql: string, params: any[]}}
 */
function influencerFilter(req, kolom = 'influencer_id', db = getDb()) {
  const ids = toegestaneInfluencerIds(req, db);
  if (ids === null) return { sql: '', params: [] };
  if (ids.length === 0) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${kolom} IN (${ids.map(() => '?').join(',')})`, params: ids };
}

function magInfluencerZien(req, influencerId, db = getDb()) {
  const ids = toegestaneInfluencerIds(req, db);
  return ids === null || ids.includes(Number(influencerId));
}

module.exports = {
  ALLE_INFLUENCERS_ROLLEN,
  eigenInfluencerIds,
  toegestaneInfluencerIds,
  influencerFilter,
  magInfluencerZien,
};
