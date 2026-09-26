import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "polarops.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('duty_officer', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL CHECK (region IN ('Antarctic', 'Arctic')),
    lat REAL NOT NULL,
    lng REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expeditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Planned', 'Active', 'Completed')),
    region TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    team_lead TEXT NOT NULL,
    waypoints TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cargo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manifest_id TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Delivered', 'In Transit', 'Delayed', 'Pending')),
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    station_id TEXT REFERENCES stations(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'units',
    needs_maintenance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    station_id TEXT REFERENCES stations(id),
    status TEXT NOT NULL CHECK (status IN ('In Field', 'On Leave', 'Base')),
    last_checkin TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emergencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'resolved')),
    status TEXT NOT NULL CHECK (status IN ('Open', 'Resolved')),
    station_id TEXT REFERENCES stations(id),
    reported_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations for databases created before these columns existed.
const personnelColumns = db.prepare("PRAGMA table_info(personnel)").all();
if (!personnelColumns.some((col) => col.name === "last_checkin")) {
  db.exec("ALTER TABLE personnel ADD COLUMN last_checkin TEXT");
}
const inventoryColumns = db.prepare("PRAGMA table_info(inventory)").all();
if (!inventoryColumns.some((col) => col.name === "station_id")) {
  db.exec("ALTER TABLE inventory ADD COLUMN station_id TEXT REFERENCES stations(id)");
}

function seedIfEmpty() {
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    );
    insertUser.run(
      "duty.officer@polarops.io",
      bcrypt.hashSync("icebreaker26", 10),
      "Duty Officer",
      "duty_officer"
    );
    insertUser.run(
      "admin@polarops.io",
      bcrypt.hashSync("glacieradmin26", 10),
      "Ops Admin",
      "admin"
    );
  }

  const stationCount = db.prepare("SELECT COUNT(*) AS n FROM stations").get().n;
  if (stationCount === 0) {
    const insertStation = db.prepare(
      "INSERT INTO stations (id, name, region, lat, lng) VALUES (?, ?, ?, ?, ?)"
    );
    const stations = [
      ["amundsen-scott", "Amundsen-Scott South Pole Station", "Antarctic", -89.9, 0],
      ["mcmurdo", "McMurdo Station", "Antarctic", -77.85, 166.67],
      ["palmer", "Palmer Station", "Antarctic", -64.77, -64.05],
      ["halley", "Halley VI Research Station", "Antarctic", -75.6, -26.21],
      ["concordia", "Concordia Station", "Antarctic", -75.1, 123.35],
      ["vostok", "Vostok Station", "Antarctic", -78.46, 106.84],
      ["ny-alesund", "Ny-Ålesund Research Station", "Arctic", 78.92, 11.93],
      ["alert", "Alert", "Arctic", 82.5, -62.35],
      ["summit-camp", "Summit Camp", "Arctic", 72.58, -38.46],
      ["barentsburg", "Barentsburg", "Arctic", 78.06, 14.23],
    ];
    for (const s of stations) insertStation.run(...s);
  }

  const expeditionCount = db.prepare("SELECT COUNT(*) AS n FROM expeditions").get().n;
  if (expeditionCount === 0) {
    const insertExp = db.prepare(
      `INSERT INTO expeditions (name, status, region, start_date, end_date, team_lead, waypoints)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertExp.run(
      "Ross Ice Shelf Traverse",
      "Active",
      "Antarctic",
      "2026-08-01",
      null,
      "Dr. Elena Kowalski",
      JSON.stringify(["mcmurdo", "vostok"])
    );
    insertExp.run(
      "Svalbard Glacier Survey",
      "Planned",
      "Arctic",
      "2026-10-15",
      null,
      "Anders Solberg",
      JSON.stringify(["ny-alesund", "barentsburg"])
    );
    insertExp.run(
      "Dome C Ice Core Recovery",
      "Active",
      "Antarctic",
      "2026-07-20",
      null,
      "Dr. Marco Rinaldi",
      JSON.stringify(["concordia", "vostok"])
    );
    insertExp.run(
      "Greenland Traverse North",
      "Completed",
      "Arctic",
      "2026-05-01",
      "2026-06-10",
      "Kirsten Bruun",
      JSON.stringify(["summit-camp", "alert"])
    );
    insertExp.run(
      "Weddell Sea Coastal Survey",
      "Planned",
      "Antarctic",
      "2026-11-01",
      null,
      "Dr. Elena Kowalski",
      JSON.stringify(["halley", "palmer"])
    );
  }

  const cargoCount = db.prepare("SELECT COUNT(*) AS n FROM cargo").get().n;
  if (cargoCount === 0) {
    const insertCargo = db.prepare(
      `INSERT INTO cargo (manifest_id, description, status, origin, destination, weight_kg) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertCargo.run("MAN-1042", "Fuel drums (diesel)", "In Transit", "McMurdo Station", "Vostok Station", 4200);
    insertCargo.run("MAN-1043", "Resupply — fresh produce", "Delayed", "Christchurch", "McMurdo Station", 850);
    insertCargo.run("MAN-1044", "Scientific equipment", "Delivered", "Ny-Ålesund", "Barentsburg", 320);
    insertCargo.run("MAN-1045", "Medical supplies", "Delivered", "Palmer Station", "Halley VI Station", 140);
    insertCargo.run("MAN-1046", "Ice core sample containers", "Pending", "Concordia Station", "Hobart", 610);
    insertCargo.run("MAN-1047", "Generator parts", "In Transit", "Alert", "Summit Camp", 275);
  }

  const inventoryCount = db.prepare("SELECT COUNT(*) AS n FROM inventory").get().n;
  if (inventoryCount === 0) {
    const insertInv = db.prepare(
      `INSERT INTO inventory (name, category, quantity, threshold, unit, needs_maintenance) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertInv.run("Diesel fuel", "Fuel", 12000, 5000, "L", 0);
    insertInv.run("Snowmobiles", "Vehicles", 4, 3, "units", 1);
    insertInv.run("Emergency rations", "Food", 180, 200, "kits", 0);
    insertInv.run("Satellite phones", "Comms", 9, 5, "units", 0);
    insertInv.run("Weather balloons", "Research", 22, 25, "units", 0);
    insertInv.run("Generator units", "Power", 6, 4, "units", 1);
    insertInv.run("Cold-weather suits", "Safety", 40, 30, "sets", 0);
  }

  const personnelCount = db.prepare("SELECT COUNT(*) AS n FROM personnel").get().n;
  if (personnelCount === 0) {
    const insertPerson = db.prepare(
      `INSERT INTO personnel (name, role, station_id, status) VALUES (?, ?, ?, ?)`
    );
    insertPerson.run("Dr. Elena Kowalski", "Expedition Lead", "mcmurdo", "In Field");
    insertPerson.run("Anders Solberg", "Glaciologist", "ny-alesund", "In Field");
    insertPerson.run("Dr. Marco Rinaldi", "Ice Core Specialist", "concordia", "In Field");
    insertPerson.run("Kirsten Bruun", "Logistics Officer", "summit-camp", "On Leave");
    insertPerson.run("Sam Whitfield", "Field Medic", "palmer", "In Field");
    insertPerson.run("Priya Nair", "Comms Officer", "vostok", "Base");
    insertPerson.run("Jonas Berg", "Mechanic", "alert", "In Field");
    insertPerson.run("Dr. Wei Chen", "Atmospheric Scientist", "halley", "In Field");
  }

  const emergencyCount = db.prepare("SELECT COUNT(*) AS n FROM emergencies").get().n;
  if (emergencyCount === 0) {
    const insertEmergency = db.prepare(
      `INSERT INTO emergencies (title, severity, status, station_id, reported_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertEmergency.run(
      "Generator failure — backup power engaged",
      "critical",
      "Open",
      "vostok",
      "2026-09-20 03:14",
      null
    );
    insertEmergency.run(
      "Overdue check-in — field team",
      "warning",
      "Open",
      "summit-camp",
      "2026-09-22 11:02",
      null
    );
    insertEmergency.run(
      "Medical evacuation completed",
      "resolved",
      "Resolved",
      "palmer",
      "2026-09-15 08:40",
      "2026-09-15 22:10"
    );
    insertEmergency.run(
      "Fuel leak contained",
      "warning",
      "Open",
      "mcmurdo",
      "2026-09-23 06:55",
      null
    );
  }
}

seedIfEmpty();

// Backfill demo values for the two new columns (idempotent — only fills gaps,
// safe to run on every start whether the DB is fresh or pre-existing).
function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

const checkinBackfill = [
  ["Dr. Elena Kowalski", hoursAgo(30)], // overdue — feeds the McMurdo compound-risk demo
  ["Anders Solberg", hoursAgo(3)],
  ["Dr. Marco Rinaldi", hoursAgo(5)],
  ["Kirsten Bruun", hoursAgo(50)],
  ["Sam Whitfield", hoursAgo(2)],
  ["Priya Nair", hoursAgo(28)], // overdue — feeds the Vostok compound-risk demo
  ["Jonas Berg", hoursAgo(4)],
  ["Dr. Wei Chen", hoursAgo(6)],
];
const updateCheckin = db.prepare("UPDATE personnel SET last_checkin = ? WHERE name = ? AND last_checkin IS NULL");
for (const [name, timestamp] of checkinBackfill) updateCheckin.run(timestamp, name);

// Priya needs to be In Field (not Base) for her overdue check-in to be operationally meaningful.
db.prepare("UPDATE personnel SET status = 'In Field' WHERE name = 'Priya Nair' AND status = 'Base'").run();

const inventoryStationBackfill = [
  ["Diesel fuel", "mcmurdo"],
  ["Snowmobiles", "palmer"],
  ["Emergency rations", "vostok"],
  ["Satellite phones", "mcmurdo"],
  ["Weather balloons", "summit-camp"],
  ["Generator units", "alert"],
  ["Cold-weather suits", "halley"],
];
const updateInvStation = db.prepare("UPDATE inventory SET station_id = ? WHERE name = ? AND station_id IS NULL");
for (const [name, stationId] of inventoryStationBackfill) updateInvStation.run(stationId, name);

// Satellite phones needs to actually read as low-stock to feed the McMurdo compound-risk demo.
db.prepare("UPDATE inventory SET quantity = 4 WHERE name = 'Satellite phones' AND quantity = 9").run();

export default db;
