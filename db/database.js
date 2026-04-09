"use strict";

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "school.db");

let _db = null;

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
    initSchema(_db);
    persist(_db);
  }
  return _db;
}

function persist(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      section TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT ''
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      author_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(author_id) REFERENCES users(id)
    );
  `);

  // Seed admin
  db.run(
    `INSERT OR IGNORE INTO users (name, username, password, role, section, email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["Admin", "admin", "geheim123", "admin", "Alle secties", "admin@school.nl"],
  );

  // Seed teamleden
  const members = [
    [
      "Persoon 1",
      "persoon1",
      "wachtwoord1",
      "member",
      "Inleiding & Stelling",
      "persoon1@school.nl",
    ],
    [
      "Persoon 2",
      "persoon2",
      "wachtwoord2",
      "member",
      "Argumenten",
      "persoon2@school.nl",
    ],
    [
      "Persoon 3",
      "persoon3",
      "wachtwoord3",
      "member",
      "Conclusie & Weerlegging",
      "persoon3@school.nl",
    ],
  ];
  for (const m of members) {
    db.run(
      `INSERT OR IGNORE INTO users (name, username, password, role, section, email) VALUES (?, ?, ?, ?, ?, ?)`,
      m,
    );
  }

  // Seed secties
  const sectionData = [
    [
      "inleiding",
      "Inleiding",
      "Waarom digitalisering nu urgent is",
      "We leven in een digitale wereld. Bijna alles om ons heen is verbonden met technologie: van de supermarkt tot de dokter, van het nieuws tot onze vrienden. Toch starten Nederlandse middelbare scholieren elke dag in klaslokalen die technologisch decennia achterlopen.\n\nPapieren schoolboeken, krijtborden en mondelinge uitleg zijn na meer dan honderd jaar nog steeds de standaard. Terwijl de wereld buiten de school razendsnel digitaliseert, past het onderwijs zich nauwelijks aan. Dit is een probleem dat we serieus moeten nemen.",
      2,
      1,
    ],
    [
      "stelling",
      "Stelling",
      "Onze stelling",
      "Digitalisering op de middelbare school moet fundamenteel verbeterd worden, zodat leerlingen worden voorbereid op de digitale samenleving en alle voordelen van moderne technologie kunnen benutten voor beter, toegankelijker en efficiënter onderwijs.",
      2,
      2,
    ],
    [
      "argument1",
      "Argument 1",
      "Argument 1: Betere voorbereiding op de arbeidsmarkt",
      "Leerlingen die digitale vaardigheden beheersen, zijn beter voorbereid op de moderne arbeidsmarkt. Bijna alle sectoren vragen tegenwoordig digitale basiskennis: van boekhouding tot marketing, van gezondheidszorg tot techniek.\n\nOnderzoek van het World Economic Forum toont dat tegen 2030 meer dan 85 miljoen banen zullen verdwijnen door automatisering, maar er tegelijkertijd 97 miljoen nieuwe functies bijkomen — functies die digitale vaardigheden vereisen.",
      3,
      3,
    ],
    [
      "argument2",
      "Argument 2",
      "Argument 2: Efficiënter en gepersonaliseerd leren",
      "Digitale tools maken adaptief leren mogelijk. Software past zich aan het niveau van de individuele leerling aan, waardoor iedereen in eigen tempo leert. Dit verhoogt het leerrendement aanzienlijk ten opzichte van klassikaal onderwijs.\n\nPlatformen zoals Khan Academy, Duolingo en diverse Nederlandse leermethodes tonen aan dat leerlingen met adaptieve tools tot 60% sneller nieuwe stof beheersen.",
      3,
      4,
    ],
    [
      "argument3",
      "Argument 3",
      "Argument 3: Duurzaamheid en toegankelijkheid",
      "Digitale leermiddelen zijn goedkoper op de lange termijn dan papieren boeken. Een gemiddeld schoolboek kost €35-€50 en veroudert na 3-5 jaar. Digitale methodes worden continu bijgewerkt voor een fractie van de kosten.\n\nBovendien zijn e-books en online platforms altijd beschikbaar, ook vanuit huis. Dit vergroot de toegankelijkheid enorm voor leerlingen met een beperking, een chronische ziekte of thuissituaties waarbij fysieke school moeilijk is.",
      3,
      5,
    ],
    [
      "tegenargument",
      "Tegenargument",
      "Digitalisering leidt tot afleiding",
      "Critici stellen dat smartphones en tablets in de klas leiden tot afleiding. Leerlingen zouden social media en games gebruiken in plaats van te leren. Bovendien zou te veel schermtijd schadelijk zijn voor de ontwikkeling van jongeren, en zouden digitale vaardigheden thuis ook geleerd kunnen worden.\n\nSommige onderwijsexperts pleiten zelfs voor een terugkeer naar meer ambachtelijk schrijven en lezen, omdat dit de concentratie en diep nadenken zou bevorderen.",
      4,
      6,
    ],
    [
      "weerlegging",
      "Weerlegging",
      "Goed beleid voorkomt afleiding",
      "Dit tegenargument is begrijpelijk, maar gaat voorbij aan de kern van de zaak. Afleiding ontstaat niet door technologie zelf, maar door ontbrekend mediawijsheidsonderwijs en slechte implementatie.\n\nIn landen als Finland en Estland, waar digitalisering van het onderwijs het verst is gevorderd, scoren leerlingen juist hoger op concentratie en studieresultaten. Met duidelijke regels, educatief ontworpen software en goede begeleiding wordt technologie een krachtig leermiddel in plaats van een bron van afleiding.\n\nBovendien leert mediawijsheid leerlingen een vaardigheid die ze hun hele leven nodig hebben.",
      4,
      7,
    ],
    [
      "conclusie",
      "Conclusie",
      "Digitalisering is geen keuze meer - het is een noodzaak",
      "We hebben aangetoond dat betere digitalisering op de middelbare school om drie sterke redenen noodzakelijk is: het bereidt leerlingen voor op de arbeidsmarkt van de toekomst, het verhoogt het leerrendement door gepersonaliseerd leren en het maakt onderwijs toegankelijker en duurzamer.\n\nHet tegenargument over afleiding is begrijpelijk, maar wordt weerlegd door internationale onderzoeken die aantonen dat goed geïmplementeerde digitalisering juist betere resultaten geeft. Het gaat niet om technologie als doel, maar om technologie als middel voor beter onderwijs.",
      4,
      8,
    ],
  ];

  for (const [id, label, title, content, authorId, order] of sectionData) {
    db.run(
      `INSERT OR IGNORE INTO sections (id, label, title, content, author_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, label, title, content, authorId, order],
    );
  }
}

// ── Query helpers ────────────────────────────────────────────────

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  persist(db);
}

module.exports = { getDb, all, get, run, persist };
