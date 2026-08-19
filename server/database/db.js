const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pa-atelier.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// ============================================================
// MIGRATIES
// SQLite kan geen CHECK-constraint wijzigen met ALTER TABLE, dus tabellen
// waarvan de constraint verandert worden herbouwd. Alles is idempotent.
// ============================================================

function tabelSql(database, naam) {
  const rij = database.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(naam);
  return rij ? rij.sql : null;
}

// 1) 'manager' toevoegen aan de toegestane rollen van users
function migreerUserRollen(database) {
  const sql = tabelSql(database, 'users');
  if (!sql || sql.includes("'manager'")) return;

  database.exec(`
    ALTER TABLE users RENAME TO users_oud;
    CREATE TABLE users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      naam        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      wachtwoord  TEXT NOT NULL,
      rol         TEXT NOT NULL CHECK(rol IN ('pa', 'manager', 'staff', 'influencer')),
      actief      INTEGER NOT NULL DEFAULT 1,
      aangemaakt  TEXT NOT NULL DEFAULT (datetime('now')),
      bijgewerkt  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, naam, email, wachtwoord, rol, actief, aangemaakt, bijgewerkt)
      SELECT id, naam, email, wachtwoord, rol, actief, aangemaakt, bijgewerkt FROM users_oud;
    DROP TABLE users_oud;
  `);
  console.log('Migratie: rol "manager" toegevoegd aan users');
}

// 2) Verkoopfacturen uit finance_items halen.
//    - inkomsten-facturen verhuizen naar sales_invoices (eigendom manager)
//    - overige 'factuur'-rijen worden 'inkoopfactuur' (kosten van de PA)
function migreerVerkoopfacturenUitFinance(database) {
  const sql = tabelSql(database, 'finance_items');
  if (!sql || sql.includes("'inkoopfactuur'")) return;

  const verkoop = database.prepare(`
    SELECT f.*, i.naam AS influencer_naam
    FROM finance_items f
    JOIN influencers i ON f.influencer_id = i.id
    LEFT JOIN finance_categories fc ON f.categorie_id = fc.id
    WHERE f.type = 'factuur' AND fc.type = 'inkomsten'
  `).all();

  const invoegen = database.prepare(`
    INSERT INTO sales_invoices
      (factuurnummer, influencer_id, klant, omschrijving, bedrag, btw_percentage,
       btw_bedrag, totaal, valuta, factuurdatum, status, betaald_op, notities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let volgnummer = 1;
  for (const item of verkoop) {
    const bedrag = item.bedrag || 0;
    const btw = item.btw_bedrag || 0;
    const percentage = bedrag > 0 ? Math.round((btw / bedrag) * 100) : 21;
    const jaar = (item.datum || '').slice(0, 4) || String(new Date().getFullYear());
    invoegen.run(
      `${jaar}-M${String(volgnummer++).padStart(4, '0')}`,
      item.influencer_id,
      item.opdrachtgever || 'Onbekende klant',
      item.omschrijving,
      bedrag, percentage, btw, bedrag + btw,
      item.valuta || 'EUR',
      item.datum,
      item.betaald ? 'betaald' : 'concept',
      item.betaald_datum || null,
      ['Overgezet uit de PA-financiën bij de verhuizing van verkoopfacturen naar de manager.', item.notities]
        .filter(Boolean).join('\n')
    );
  }

  const teVerwijderen = verkoop.map(v => v.id);

  database.exec(`
    ALTER TABLE finance_items RENAME TO finance_items_oud;
    CREATE TABLE finance_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      influencer_id   INTEGER NOT NULL REFERENCES influencers(id),
      categorie_id    INTEGER REFERENCES finance_categories(id),
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
    INSERT INTO finance_items
      (id, influencer_id, categorie_id, type, omschrijving, bedrag, btw_bedrag, valuta,
       datum, betaald, betaald_datum, opdrachtgever, bestand_url, notities, aangemaakt, bijgewerkt)
      SELECT id, influencer_id, categorie_id,
             CASE WHEN type = 'factuur' THEN 'inkoopfactuur' ELSE type END,
             omschrijving, bedrag, btw_bedrag, valuta, datum, betaald, betaald_datum,
             opdrachtgever, bestand_url, notities, aangemaakt, bijgewerkt
      FROM finance_items_oud;
    DROP TABLE finance_items_oud;
  `);

  if (teVerwijderen.length > 0) {
    database.prepare(
      `DELETE FROM finance_items WHERE id IN (${teVerwijderen.map(() => '?').join(',')})`
    ).run(...teVerwijderen);
  }

  console.log(
    `Migratie: finance_items opgeschoond — ${verkoop.length} verkoopfactu(u)r(en) verhuisd naar de manager`
  );
}

function runMigrations(database) {
  const migraties = database.transaction(() => {
    migreerUserRollen(database);
    migreerVerkoopfacturenUitFinance(database);
  });
  try {
    migraties();
  } catch (err) {
    console.error('Migratie mislukt:', err.message);
  }
}

function initDatabase() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Verwijder commentaarregels EERST, dan splitsen op ';'
  const schemaZonderCommentaar = schema
    .split('\n')
    .filter(regel => !regel.trim().startsWith('--'))
    .join('\n');

  const statements = schemaZonderCommentaar
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // PRAGMAs buiten transactie uitvoeren
  const pragmas = statements.filter(s => s.toUpperCase().startsWith('PRAGMA'));
  const tabellen = statements.filter(s => !s.toUpperCase().startsWith('PRAGMA'));

  for (const pragma of pragmas) {
    try { database.prepare(pragma).run(); } catch {}
  }

  const init = database.transaction(() => {
    for (const statement of tabellen) {
      try {
        database.prepare(statement).run();
      } catch (err) {
        console.error('Schema fout:', statement.substring(0, 80), '\n ->', err.message);
      }
    }
  });

  init();
  runMigrations(database);
  console.log('Database geïnitialiseerd:', DB_PATH);
}

module.exports = { getDb, initDatabase, runMigrations };
