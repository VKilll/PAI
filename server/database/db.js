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
  console.log('Database geïnitialiseerd:', DB_PATH);
}

module.exports = { getDb, initDatabase };
