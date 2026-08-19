-- ============================================================
-- PA Atelier — Volledig Database Schema
-- SQLite (Phase 1) — Multi-tenant klaar voor PostgreSQL
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- AUTH & GEBRUIKERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  naam        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  wachtwoord  TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK(rol IN ('pa', 'manager', 'staff', 'influencer')),
  actief      INTEGER NOT NULL DEFAULT 1,
  aangemaakt  TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS influencers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  naam            TEXT NOT NULL,
  gebruikersnaam  TEXT,
  email           TEXT,
  telefoon        TEXT,
  platforms       TEXT, -- JSON: ["instagram","tiktok","youtube"]
  kledingmaat     TEXT,
  schoensmaat     TEXT,
  kleurprofiel    TEXT, -- JSON: {likes, dislikes}
  notities        TEXT,
  avatar_url      TEXT,
  user_id         INTEGER REFERENCES users(id),
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 1: PAKKETTEN
-- ============================================================

CREATE TABLE IF NOT EXISTS packages (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id       INTEGER NOT NULL REFERENCES influencers(id),
  merk                TEXT NOT NULL,
  omschrijving        TEXT,
  tracking_nummer     TEXT,
  vervoerder          TEXT,
  ontvangen_datum     TEXT,
  verwachte_datum     TEXT,
  status              TEXT NOT NULL DEFAULT 'verwacht'
                        CHECK(status IN ('verwacht','ontvangen','geopend','verwerkt','retour_aangemeld','geretourneerd','afgerond')),
  retour_vereist      INTEGER NOT NULL DEFAULT 0,
  retour_deadline     TEXT,
  retour_beleid       TEXT, -- AI-opgehaald retourbeleid
  retour_beleid_bron  TEXT,
  foto_urls           TEXT, -- JSON array van foto paden
  notities            TEXT,
  aangemaakt          TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS package_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id  INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  naam        TEXT NOT NULL,
  categorie   TEXT, -- kleding, schoenen, accessoires, beauty, etc.
  merk        TEXT,
  maat        TEXT,
  kleur       TEXT,
  waarde      REAL,
  notities    TEXT
);

CREATE TABLE IF NOT EXISTS package_status_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id  INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  van_status  TEXT,
  naar_status TEXT NOT NULL,
  notitie     TEXT,
  gewijzigd_door INTEGER REFERENCES users(id),
  aangemaakt  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 2: FINANCIËN
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  naam  TEXT NOT NULL UNIQUE,
  type  TEXT NOT NULL CHECK(type IN ('inkomsten','uitgaven'))
);

CREATE TABLE IF NOT EXISTS finance_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  categorie_id    INTEGER REFERENCES finance_categories(id),
  -- LET OP: verkoopfacturen horen NIET in finance_items. Die staan in sales_invoices
  -- en zijn eigendom van de manager. Hier alleen kosten/bonnen/betalingen van de PA.
  type            TEXT NOT NULL CHECK(type IN ('inkoopfactuur','bon','betaling','salarisoverzicht')),
  omschrijving    TEXT NOT NULL,
  bedrag          REAL NOT NULL,
  btw_bedrag      REAL DEFAULT 0,
  valuta          TEXT NOT NULL DEFAULT 'EUR',
  datum           TEXT NOT NULL,
  betaald         INTEGER NOT NULL DEFAULT 0,
  betaald_datum   TEXT,
  opdrachtgever   TEXT,
  bestand_url     TEXT,
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_summaries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  week_nummer     INTEGER NOT NULL,
  jaar            INTEGER NOT NULL,
  totaal_in       REAL NOT NULL DEFAULT 0,
  totaal_uit      REAL NOT NULL DEFAULT 0,
  saldo           REAL NOT NULL DEFAULT 0,
  samenvatting    TEXT, -- JSON detail
  verstuurd       INTEGER NOT NULL DEFAULT 0,
  verstuurd_op    TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 3: REIZEN
-- ============================================================

CREATE TABLE IF NOT EXISTS travel_preferences (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL UNIQUE REFERENCES influencers(id),
  vliegtuig_klas  TEXT DEFAULT 'economy' CHECK(vliegtuig_klas IN ('economy','business','first')),
  stoel_voorkeur  TEXT,
  hotel_sterren   INTEGER DEFAULT 4,
  hotel_wensen    TEXT, -- JSON: {breakfast: true, gym: true, ...}
  dieetwensen     TEXT,
  extra_wensen    TEXT,
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS travel_trips (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  naam            TEXT NOT NULL,
  bestemming      TEXT NOT NULL,
  vertrek_datum   TEXT NOT NULL,
  terug_datum     TEXT NOT NULL,
  doel            TEXT, -- werk, vakantie, event
  status          TEXT NOT NULL DEFAULT 'gepland'
                    CHECK(status IN ('gepland','bevestigd','lopend','afgerond','geannuleerd')),
  budget          REAL,
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS travel_flights (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  vlucht_nummer   TEXT,
  maatschappij    TEXT,
  van             TEXT NOT NULL,
  naar            TEXT NOT NULL,
  vertrek_tijd    TEXT NOT NULL,
  aankomst_tijd   TEXT NOT NULL,
  klasse          TEXT,
  bevestigings_nr TEXT,
  prijs           REAL,
  bestand_url     TEXT,
  notities        TEXT
);

CREATE TABLE IF NOT EXISTS travel_hotels (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  naam            TEXT NOT NULL,
  adres           TEXT,
  check_in        TEXT NOT NULL,
  check_out       TEXT NOT NULL,
  kamer_type      TEXT,
  bevestigings_nr TEXT,
  prijs_per_nacht REAL,
  totaal_prijs    REAL,
  bestand_url     TEXT,
  notities        TEXT
);

-- ============================================================
-- MODULE 4: CONTENT
-- ============================================================

CREATE TABLE IF NOT EXISTS content_platforms (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  naam  TEXT NOT NULL UNIQUE,  -- instagram, tiktok, youtube, etc.
  kleur TEXT DEFAULT '#000000'
);

CREATE TABLE IF NOT EXISTS content_posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  platform_id     INTEGER NOT NULL REFERENCES content_platforms(id),
  titel           TEXT,
  omschrijving    TEXT,
  type            TEXT NOT NULL CHECK(type IN ('feed','reel','story','video','live','blog')),
  geplande_datum  TEXT NOT NULL,
  geplande_tijd   TEXT,
  gepost_datum    TEXT,
  status          TEXT NOT NULL DEFAULT 'gepland'
                    CHECK(status IN ('idee','gepland','concept','goedgekeurd','gepost','geverifieerd')),
  caption         TEXT,
  hashtags        TEXT,
  media_urls      TEXT, -- JSON array
  briefing_id     INTEGER REFERENCES briefings(id),
  statistieken    TEXT, -- JSON: {likes, views, bereik, etc.}
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 5: BRIEFINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS briefings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  opdrachtgever   TEXT NOT NULL,
  titel           TEXT NOT NULL,
  origineel_bestand TEXT,
  bestand_type    TEXT, -- pdf, docx, txt, jpg
  ruwe_tekst      TEXT, -- geëxtraheerde tekst
  ai_samenvatting TEXT,
  status          TEXT NOT NULL DEFAULT 'nieuw'
                    CHECK(status IN ('nieuw','verwerkt','lopend','afgerond')),
  ontvangen_datum TEXT NOT NULL DEFAULT (date('now')),
  deadline        TEXT,
  live_datum      TEXT,          -- wanneer de content live moet
  vergoeding      REAL,
  hashtags        TEXT,          -- JSON array
  vermeldingen    TEXT,          -- JSON array van @accounts
  exclusiviteit   TEXT,
  ai_extractie    TEXT,          -- JSON: volledige uitlezing door de AI
  ai_status       TEXT NOT NULL DEFAULT 'niet_gedraaid'
                    CHECK(ai_status IN ('niet_gedraaid','bezig','klaar','mislukt','handmatig')),
  ai_fout         TEXT,
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS briefing_deliverables (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  platform    TEXT,
  deadline    TEXT,
  afgerond    INTEGER NOT NULL DEFAULT 0,
  afgerond_op TEXT,
  notities    TEXT
);

CREATE TABLE IF NOT EXISTS briefing_reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  bericht     TEXT NOT NULL,
  herinner_op TEXT NOT NULL,
  verstuurd   INTEGER NOT NULL DEFAULT 0,
  verstuurd_op TEXT
);

-- ============================================================
-- MODULE 6: RESEARCH
-- ============================================================

CREATE TABLE IF NOT EXISTS research_reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  week_nummer     INTEGER NOT NULL,
  jaar            INTEGER NOT NULL,
  onderwerp       TEXT NOT NULL DEFAULT 'wekelijkse trends',
  inhoud          TEXT, -- Markdown rapport
  trends          TEXT, -- JSON array van trends
  aanbevelingen   TEXT, -- JSON array
  bronnen         TEXT, -- JSON array van URLs
  ai_model        TEXT,
  verstuurd       INTEGER NOT NULL DEFAULT 0,
  verstuurd_op    TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 7: STATISTIEKEN
-- ============================================================

CREATE TABLE IF NOT EXISTS stats_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  platform_id     INTEGER NOT NULL REFERENCES content_platforms(id),
  datum           TEXT NOT NULL,
  screenshot_url  TEXT,
  volgers         INTEGER,
  volgend         INTEGER,
  berichten       INTEGER,
  bereik          INTEGER,
  indrukken       INTEGER,
  profielbezoeken INTEGER,
  engagement_rate REAL,
  likes           INTEGER,
  reacties        INTEGER,
  opgeslagen      INTEGER,
  shares          INTEGER,
  ai_geextraheerd INTEGER NOT NULL DEFAULT 0,
  ruwe_data       TEXT, -- JSON van AI extractie
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats_monthly_reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  maand           INTEGER NOT NULL,
  jaar            INTEGER NOT NULL,
  samenvatting    TEXT, -- Markdown rapport
  groei_data      TEXT, -- JSON
  verstuurd       INTEGER NOT NULL DEFAULT 0,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 8: ENGAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS influencer_voice_profiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL UNIQUE REFERENCES influencers(id),
  toon            TEXT, -- speels, serieus, humoristisch, inspirerend
  stijl           TEXT, -- casual, formeel, mix
  emoji_gebruik   INTEGER NOT NULL DEFAULT 1,
  woordenschat    TEXT, -- JSON: veelgebruikte woorden/uitdrukkingen
  vermijd         TEXT, -- JSON: woorden/onderwerpen vermijden
  voorbeelden     TEXT, -- JSON array van echte reacties als referentie
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engagement_replies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
  platform        TEXT NOT NULL,
  origineel_comment TEXT NOT NULL,
  gebruikersnaam  TEXT,
  ai_antwoord     TEXT NOT NULL,
  goedgekeurd     INTEGER NOT NULL DEFAULT 0,
  geplaatst       INTEGER NOT NULL DEFAULT 0,
  geplaatst_op    TEXT,
  notities        TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FASHION WEEK KALENDER
-- ============================================================

CREATE TABLE IF NOT EXISTS fashion_week_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  naam        TEXT NOT NULL,
  stad        TEXT NOT NULL,
  seizoen     TEXT NOT NULL CHECK(seizoen IN ('SS','AW')),
  jaar        INTEGER NOT NULL,
  start_datum TEXT NOT NULL,
  eind_datum  TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'rtw'
                CHECK(type IN ('rtw','couture','menswear','resort')),
  website     TEXT,
  notities    TEXT
);

-- ============================================================
-- SYSTEEM: CRON JOBS LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  taak        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('gestart','geslaagd','mislukt')),
  bericht     TEXT,
  uitgevoerd  TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ============================================================
-- MODULE 9: SAMENWERKINGEN (COLLABORATIONS)
-- Front = lopend, Archief = gepost/afgerond/geannuleerd
-- ============================================================

CREATE TABLE IF NOT EXISTS collaborations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id      INTEGER NOT NULL REFERENCES influencers(id),
  klant              TEXT NOT NULL,        -- opdrachtgever / merk
  klant_contact      TEXT,
  klant_email        TEXT,
  klant_adres        TEXT,
  titel              TEXT NOT NULL,
  omschrijving       TEXT,
  bedrag             REAL NOT NULL DEFAULT 0,   -- vergoeding excl. BTW
  btw_percentage     REAL NOT NULL DEFAULT 21,
  valuta             TEXT NOT NULL DEFAULT 'EUR',
  briefing_id        INTEGER REFERENCES briefings(id),
  content_post_id    INTEGER REFERENCES content_posts(id),
  platform           TEXT,
  deadline           TEXT,
  post_datum         TEXT,                 -- wanneer daadwerkelijk gepost
  status             TEXT NOT NULL DEFAULT 'aanvraag'
                       CHECK(status IN ('aanvraag','bevestigd','in_productie','gepost','afgerond','geannuleerd')),
  gearchiveerd       INTEGER NOT NULL DEFAULT 0,
  gearchiveerd_op    TEXT,
  sales_invoice_id   INTEGER REFERENCES sales_invoices(id),
  notities           TEXT,
  aangemaakt         TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collaboration_status_history (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  collaboration_id  INTEGER NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  van_status        TEXT,
  naar_status       TEXT NOT NULL,
  notitie           TEXT,
  gewijzigd_door    INTEGER REFERENCES users(id),
  aangemaakt        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 10: VERKOOPFACTUREN — EIGENDOM VAN DE MANAGER
-- De PA heeft hier geen toegang toe (zie routes/salesInvoices.js).
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_invoices (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  factuurnummer             TEXT NOT NULL UNIQUE,
  collaboration_id          INTEGER REFERENCES collaborations(id),
  influencer_id             INTEGER NOT NULL REFERENCES influencers(id),
  klant                     TEXT NOT NULL,
  klant_contact             TEXT,
  klant_email               TEXT,
  klant_adres               TEXT,
  omschrijving              TEXT NOT NULL,
  bedrag                    REAL NOT NULL DEFAULT 0,   -- excl. BTW
  btw_percentage            REAL NOT NULL DEFAULT 21,
  btw_bedrag                REAL NOT NULL DEFAULT 0,
  totaal                    REAL NOT NULL DEFAULT 0,   -- incl. BTW
  valuta                    TEXT NOT NULL DEFAULT 'EUR',
  factuurdatum              TEXT NOT NULL DEFAULT (date('now')),
  vervaldatum               TEXT,
  status                    TEXT NOT NULL DEFAULT 'concept'
                              CHECK(status IN ('concept','goedgekeurd','verzonden','betaald','geannuleerd')),
  automatisch_aangemaakt     INTEGER NOT NULL DEFAULT 0,
  aangemaakt_door           INTEGER REFERENCES users(id),
  goedgekeurd_door          INTEGER REFERENCES users(id),
  goedgekeurd_op            TEXT,
  verzonden_op              TEXT,
  verzonden_naar            TEXT,
  betaald_op                TEXT,
  -- Influencer mag pas zijn/haar eigen factuur sturen NA akkoord van de manager
  influencer_vrijgegeven    INTEGER NOT NULL DEFAULT 0,
  influencer_vrijgegeven_op TEXT,
  influencer_vrijgegeven_door INTEGER REFERENCES users(id),
  notities                  TEXT,
  aangemaakt                TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt                TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- NOTIFICATIES (pop-ups, o.a. "samenwerking afgerond" voor de manager)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  doel_rol       TEXT,                 -- 'manager' | 'pa' | 'staff' | 'influencer'
  doel_user_id   INTEGER REFERENCES users(id),
  type           TEXT NOT NULL,        -- 'samenwerking_afgerond' | 'factuur_vrijgegeven' | ...
  titel          TEXT NOT NULL,
  bericht        TEXT,
  entiteit_type  TEXT,                 -- 'collaboration' | 'sales_invoice'
  entiteit_id    INTEGER,
  link           TEXT,
  prioriteit     TEXT NOT NULL DEFAULT 'normaal' CHECK(prioriteit IN ('laag','normaal','hoog')),
  gelezen        INTEGER NOT NULL DEFAULT 0,
  gelezen_op     TEXT,
  afgehandeld    INTEGER NOT NULL DEFAULT 0,
  afgehandeld_op TEXT,
  aangemaakt     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PORTAAL BERICHTEN (manager -> influencer)
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_messages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id     INTEGER NOT NULL REFERENCES influencers(id),
  van_user_id       INTEGER REFERENCES users(id),
  type              TEXT NOT NULL DEFAULT 'algemeen'
                      CHECK(type IN ('algemeen','factuur_verzoek')),
  onderwerp         TEXT NOT NULL,
  bericht           TEXT NOT NULL,
  sales_invoice_id  INTEGER REFERENCES sales_invoices(id),
  collaboration_id  INTEGER REFERENCES collaborations(id),
  gelezen           INTEGER NOT NULL DEFAULT 0,
  gelezen_op        TEXT,
  aangemaakt        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MODULE 11: INFLUENCER-FACTUREN
-- De influencer (of de PA namens de influencer) factureert Scala Management.
-- Kan PAS aangemaakt worden voor een samenwerking die de manager al aan de
-- klant heeft gefactureerd en heeft vrijgegeven.
-- ============================================================

CREATE TABLE IF NOT EXISTS influencer_invoices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  factuurnummer     TEXT NOT NULL,
  influencer_id     INTEGER NOT NULL REFERENCES influencers(id),
  collaboration_id  INTEGER NOT NULL REFERENCES collaborations(id),
  sales_invoice_id  INTEGER REFERENCES sales_invoices(id),
  omschrijving      TEXT NOT NULL,
  bedrag            REAL NOT NULL DEFAULT 0,   -- excl. BTW
  btw_percentage    REAL NOT NULL DEFAULT 21,
  btw_bedrag        REAL NOT NULL DEFAULT 0,
  totaal            REAL NOT NULL DEFAULT 0,
  valuta            TEXT NOT NULL DEFAULT 'EUR',
  factuurdatum      TEXT NOT NULL DEFAULT (date('now')),
  vervaldatum       TEXT,
  status            TEXT NOT NULL DEFAULT 'concept'
                      CHECK(status IN ('concept','verzonden','betaald','geannuleerd')),
  ontvanger         TEXT NOT NULL DEFAULT 'Scala Management',
  ontvanger_email   TEXT,
  verzonden_op      TEXT,
  email_status      TEXT,   -- 'verzonden' | 'mislukt' | 'niet_geconfigureerd'
  email_fout        TEXT,
  betaald_op        TEXT,
  bestand_url       TEXT,
  aangemaakt_door   INTEGER REFERENCES users(id),
  aangemaakt_namens TEXT NOT NULL DEFAULT 'influencer'
                      CHECK(aangemaakt_namens IN ('influencer','pa')),
  notities          TEXT,
  aangemaakt        TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(influencer_id, factuurnummer)
);

-- ============================================================
-- MODULE 12: FEEDS & INSTAGRAM-KOPPELING
-- ============================================================

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id   INTEGER NOT NULL UNIQUE REFERENCES influencers(id),
  ig_gebruiker_id TEXT,      -- Instagram Business Account ID
  gebruikersnaam  TEXT,
  pagina_id       TEXT,      -- gekoppelde Facebook-pagina
  toegangstoken   TEXT,      -- long-lived token
  token_verloopt  TEXT,
  status          TEXT NOT NULL DEFAULT 'niet_gekoppeld'
                    CHECK(status IN ('niet_gekoppeld','gekoppeld','token_verlopen','fout')),
  laatste_sync    TEXT,
  laatste_fout    TEXT,
  aangemaakt      TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feed_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id    INTEGER NOT NULL REFERENCES influencers(id),
  bron             TEXT NOT NULL DEFAULT 'handmatig' CHECK(bron IN ('instagram','handmatig')),
  externe_id       TEXT,     -- media-id bij Instagram
  media_type       TEXT,     -- IMAGE / VIDEO / CAROUSEL_ALBUM / REEL
  permalink        TEXT,
  media_url        TEXT,
  thumbnail_url    TEXT,
  caption          TEXT,
  hashtags         TEXT,     -- JSON array
  gepost_op        TEXT,
  likes            INTEGER,
  reacties         INTEGER,
  bereik           INTEGER,
  weergaven        INTEGER,
  collaboration_id INTEGER REFERENCES collaborations(id),
  notities         TEXT,
  aangemaakt       TEXT NOT NULL DEFAULT (datetime('now')),
  bijgewerkt       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(influencer_id, bron, externe_id)
);

-- ============================================================
-- MODULE 13: VANDAAG (AGENDA)
-- De agenda-items worden afgeleid uit de echte records — samenwerkingen,
-- posts, pakketten en facturen — en dus nooit met de hand bijgehouden.
-- Hier staat alleen wat je met een verstreken item hebt besloten.
-- ============================================================

CREATE TABLE IF NOT EXISTS agenda_beslissingen (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  bron_type     TEXT NOT NULL,   -- collaboration | content_post | package | sales_invoice | influencer_invoice
  bron_id       INTEGER NOT NULL,
  soort         TEXT NOT NULL,   -- welk agenda-item van dat record
  influencer_id INTEGER REFERENCES influencers(id),
  beslissing    TEXT NOT NULL CHECK(beslissing IN ('gedaan','vervallen','verschoven')),
  nieuwe_datum  TEXT,
  toelichting   TEXT,
  door          INTEGER REFERENCES users(id),
  aangemaakt    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bron_type, bron_id, soort)
);

CREATE TABLE IF NOT EXISTS agenda_controles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  datum        TEXT NOT NULL,
  uitgevoerd_op TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, datum)
);

-- ============================================================
-- INDEXES voor snelheid
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_packages_influencer ON packages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_finance_influencer ON finance_items(influencer_id);
CREATE INDEX IF NOT EXISTS idx_finance_datum ON finance_items(datum);
CREATE INDEX IF NOT EXISTS idx_content_posts_datum ON content_posts(geplande_datum);
CREATE INDEX IF NOT EXISTS idx_content_posts_influencer ON content_posts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_stats_datum ON stats_entries(datum);
CREATE INDEX IF NOT EXISTS idx_briefings_influencer ON briefings(influencer_id);
CREATE INDEX IF NOT EXISTS idx_travel_trips_datum ON travel_trips(vertrek_datum);

CREATE INDEX IF NOT EXISTS idx_collaborations_influencer ON collaborations(influencer_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_status ON collaborations(status);
CREATE INDEX IF NOT EXISTS idx_collaborations_archief ON collaborations(gearchiveerd);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_influencer ON sales_invoices(influencer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_doel ON notifications(doel_rol, gelezen);
CREATE INDEX IF NOT EXISTS idx_portal_messages_influencer ON portal_messages(influencer_id, gelezen);
CREATE INDEX IF NOT EXISTS idx_influencer_invoices_influencer ON influencer_invoices(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_invoices_collab ON influencer_invoices(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_influencer ON feed_items(influencer_id, gepost_op);
CREATE INDEX IF NOT EXISTS idx_agenda_beslissingen_bron ON agenda_beslissingen(bron_type, bron_id);
