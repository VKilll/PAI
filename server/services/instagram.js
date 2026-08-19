// ============================================================
// Instagram-koppeling via de Instagram Graph API
//
// Voorwaarden aan de kant van Meta:
//  - het account is een Business- of Creator-account en hangt aan een
//    Facebook-pagina (persoonlijke accounts kunnen niet uitgelezen worden)
//  - een Meta-app met de rechten instagram_basic en pages_show_list,
//    plus instagram_manage_insights voor de cijfers
//  - een long-lived token; die verloopt na ongeveer 60 dagen en wordt
//    hieronder ververst zolang hij nog geldig is
//
// Zolang er geen koppeling is blijft de feed gewoon handmatig te vullen.
// ============================================================

const GRAPH = 'https://graph.facebook.com/v21.0';

const VELDEN = [
  'id', 'caption', 'media_type', 'media_url', 'thumbnail_url',
  'permalink', 'timestamp', 'like_count', 'comments_count',
].join(',');

function isGeconfigureerd() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

async function graphGet(pad, params = {}) {
  const url = new URL(`${GRAPH}/${pad}`);
  for (const [sleutel, waarde] of Object.entries(params)) {
    if (waarde !== undefined && waarde !== null) url.searchParams.set(sleutel, waarde);
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fout = data?.error || {};
    const err = new Error(fout.message || `Instagram gaf status ${response.status}`);
    err.code = fout.code;
    err.type = fout.type;
    err.status = response.status;
    throw err;
  }
  return data;
}

/**
 * Wisselt een short-lived token om voor een long-lived token (~60 dagen).
 */
async function verlengToken(kortToken) {
  if (!isGeconfigureerd()) {
    throw new Error('META_APP_ID en META_APP_SECRET ontbreken in de serverconfiguratie');
  }
  const data = await graphGet('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    fb_exchange_token: kortToken,
  });

  const verlooptOver = data.expires_in || 60 * 24 * 3600;
  return {
    token: data.access_token,
    verloopt: new Date(Date.now() + verlooptOver * 1000).toISOString().split('T')[0],
  };
}

/**
 * Zoekt bij een token het Instagram Business Account op dat aan een
 * Facebook-pagina hangt.
 */
async function zoekAccount(token) {
  const paginas = await graphGet('me/accounts', {
    access_token: token,
    fields: 'id,name,instagram_business_account{id,username}',
  });

  const metInstagram = (paginas.data || []).find(p => p.instagram_business_account);
  if (!metInstagram) {
    throw new Error(
      'Geen Instagram Business-account gevonden. Controleer of het account een Business- of Creator-account is ' +
      'en aan een Facebook-pagina gekoppeld staat.'
    );
  }

  return {
    ig_gebruiker_id: metInstagram.instagram_business_account.id,
    gebruikersnaam:  metInstagram.instagram_business_account.username,
    pagina_id:       metInstagram.id,
  };
}

function haalHashtags(caption) {
  return [...new Set((caption || '').match(/#[\wÀ-ſ]+/g) || [])];
}

/**
 * Haalt de recente posts op van een gekoppeld account.
 */
async function haalFeed(account, limiet = 25) {
  const data = await graphGet(`${account.ig_gebruiker_id}/media`, {
    access_token: account.toegangstoken,
    fields: VELDEN,
    limit: limiet,
  });

  return (data.data || []).map(item => ({
    externe_id:    item.id,
    media_type:    item.media_type,
    permalink:     item.permalink,
    media_url:     item.media_url || null,
    thumbnail_url: item.thumbnail_url || item.media_url || null,
    caption:       item.caption || null,
    hashtags:      JSON.stringify(haalHashtags(item.caption)),
    gepost_op:     item.timestamp ? item.timestamp.split('T')[0] : null,
    likes:         item.like_count ?? null,
    reacties:      item.comments_count ?? null,
  }));
}

module.exports = { isGeconfigureerd, verlengToken, zoekAccount, haalFeed, haalHashtags };
