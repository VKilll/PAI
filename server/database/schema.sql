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
  rol         TEXT NOT NULL CHECK(rol IN ('pa', 'staff', 'influencer')),
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
  type            TEXT NOT NULL CHECK(type IN ('factuur','bon','betaling','salarisoverzicht')),
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
  vergoeding      REAL,
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
