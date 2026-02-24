require('dotenv').config({ path: '../../.env' });
const bcrypt = require('bcryptjs');
const { getDb, initDatabase } = require('./db');

initDatabase();
const db = getDb();

const seed = db.transaction(() => {
  console.log('Seed data aanmaken...');

  // ── Gebruikers ────────────────────────────────────────────
  const wachtwoord = bcrypt.hashSync('welkom123', 10);

  db.prepare(`INSERT OR IGNORE INTO users (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)`)
    .run('Sophie de PA', 'pa@pa-atelier.nl', wachtwoord, 'pa');

  db.prepare(`INSERT OR IGNORE INTO users (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)`)
    .run('Lisa Staff', 'staff@pa-atelier.nl', wachtwoord, 'staff');

  db.prepare(`INSERT OR IGNORE INTO users (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)`)
    .run('Emma Influencer', 'emma@pa-atelier.nl', wachtwoord, 'influencer');

  // ── Influencers ───────────────────────────────────────────
  const emmaUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get('emma@pa-atelier.nl');

  db.prepare(`
    INSERT OR IGNORE INTO influencers
      (naam, gebruikersnaam, email, telefoon, platforms, kledingmaat, schoensmaat, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Emma van Dijk',
    '@emmavandijk',
    'emma@pa-atelier.nl',
    '+31612345678',
    JSON.stringify(['instagram', 'tiktok', 'youtube']),
    'S/36',
    '38',
    emmaUser?.id || null
  );

  db.prepare(`
    INSERT OR IGNORE INTO influencers
      (naam, gebruikersnaam, email, platforms, kledingmaat, schoensmaat)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'Julia Bakker',
    '@juliabakker',
    'julia@pa-atelier.nl',
    JSON.stringify(['instagram', 'youtube']),
    'M/38',
    '39'
  );

  // ── Content platforms ─────────────────────────────────────
  const platforms = [
    { naam: 'instagram', kleur: '#E1306C' },
    { naam: 'tiktok',    kleur: '#000000' },
    { naam: 'youtube',   kleur: '#FF0000' },
    { naam: 'pinterest', kleur: '#E60023' },
    { naam: 'blog',      kleur: '#4A90D9' },
  ];
  for (const p of platforms) {
    db.prepare(`INSERT OR IGNORE INTO content_platforms (naam, kleur) VALUES (?, ?)`)
      .run(p.naam, p.kleur);
  }

  // ── Finance categorieën ───────────────────────────────────
  const categorieën = [
    { naam: 'Samenwerkingen',    type: 'inkomsten' },
    { naam: 'Gifted producten',  type: 'inkomsten' },
    { naam: 'Affiliate',         type: 'inkomsten' },
    { naam: 'Kleding & styling', type: 'uitgaven'  },
    { naam: 'Reiskosten',        type: 'uitgaven'  },
    { naam: 'Fotografie',        type: 'uitgaven'  },
    { naam: 'Software & tools',  type: 'uitgaven'  },
    { naam: 'Overig',            type: 'uitgaven'  },
  ];
  for (const c of categorieën) {
    db.prepare(`INSERT OR IGNORE INTO finance_categories (naam, type) VALUES (?, ?)`)
      .run(c.naam, c.type);
  }

  // ── Fashion week evenementen (Women's RTW only) ───────────
  const fashionWeekEvents = [
    // 2025 SS
    { naam: 'New York Fashion Week',   stad: 'New York',  seizoen: 'SS', jaar: 2025, start: '2025-02-07', eind: '2025-02-12' },
    { naam: 'London Fashion Week',     stad: 'Londen',    seizoen: 'SS', jaar: 2025, start: '2025-02-14', eind: '2025-02-18' },
    { naam: 'Milan Fashion Week',      stad: 'Milaan',    seizoen: 'SS', jaar: 2025, start: '2025-02-18', eind: '2025-02-24' },
    { naam: 'Paris Fashion Week',      stad: 'Parijs',    seizoen: 'SS', jaar: 2025, start: '2025-02-24', eind: '2025-03-04' },
    // 2025 AW
    { naam: 'New York Fashion Week',   stad: 'New York',  seizoen: 'AW', jaar: 2025, start: '2025-09-05', eind: '2025-09-10' },
    { naam: 'London Fashion Week',     stad: 'Londen',    seizoen: 'AW', jaar: 2025, start: '2025-09-12', eind: '2025-09-16' },
    { naam: 'Milan Fashion Week',      stad: 'Milaan',    seizoen: 'AW', jaar: 2025, start: '2025-09-16', eind: '2025-09-22' },
    { naam: 'Paris Fashion Week',      stad: 'Parijs',    seizoen: 'AW', jaar: 2025, start: '2025-09-22', eind: '2025-09-30' },
    // 2026 SS
    { naam: 'New York Fashion Week',   stad: 'New York',  seizoen: 'SS', jaar: 2026, start: '2026-02-06', eind: '2026-02-11' },
    { naam: 'London Fashion Week',     stad: 'Londen',    seizoen: 'SS', jaar: 2026, start: '2026-02-13', eind: '2026-02-17' },
    { naam: 'Milan Fashion Week',      stad: 'Milaan',    seizoen: 'SS', jaar: 2026, start: '2026-02-17', eind: '2026-02-23' },
    { naam: 'Paris Fashion Week',      stad: 'Parijs',    seizoen: 'SS', jaar: 2026, start: '2026-02-23', eind: '2026-03-03' },
  ];

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO fashion_week_events
      (naam, stad, seizoen, jaar, start_datum, eind_datum, type)
    VALUES (?, ?, ?, ?, ?, ?, 'rtw')
  `);
  for (const e of fashionWeekEvents) {
    insertEvent.run(e.naam, e.stad, e.seizoen, e.jaar, e.start, e.eind);
  }

  // ── Demo pakket ───────────────────────────────────────────
  const emma = db.prepare(`SELECT id FROM influencers WHERE gebruikersnaam = '@emmavandijk'`).get();
  if (emma) {
    db.prepare(`
      INSERT OR IGNORE INTO packages
        (influencer_id, merk, omschrijving, tracking_nummer, vervoerder, status, retour_vereist, retour_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      emma.id,
      'Jacquemus',
      'Lente/zomer 2025 collectie — 3 items ter recensie',
      'JQ20250224001',
      'DHL',
      'ontvangen',
      1,
      '2025-03-10'
    );
  }

  console.log('Seed data succesvol aangemaakt!');
  console.log('Inloggegevens:');
  console.log('  PA:          pa@pa-atelier.nl / welkom123');
  console.log('  Staff:       staff@pa-atelier.nl / welkom123');
  console.log('  Influencer:  emma@pa-atelier.nl / welkom123');
});

seed();
