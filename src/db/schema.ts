export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointment_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'booked')) DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  slot_id INTEGER NOT NULL REFERENCES appointment_slots(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_type TEXT NOT NULL UNIQUE,
  price REAL NOT NULL,
  payment_methods TEXT NOT NULL
);
`;
