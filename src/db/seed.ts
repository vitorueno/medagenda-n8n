import type Database from 'better-sqlite3';

export interface SeedResult {
  patientIds: number[];
  doctorIds: number[];
  slotIds: number[];
  dates: string[];
}

export interface SeedOptions {
  referenceDate?: Date;
}

function shiftDate(reference: Date, days: number): string {
  const shifted = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + days,
  );
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${shifted.getFullYear()}-${month}-${day}`;
}

// Slot dates are derived from the current date instead of hardcoded so that a
// clone of this repository always has future availability to demo against.
export function seedDatabase(db: Database.Database, options: SeedOptions = {}): SeedResult {
  const reference = options.referenceDate ?? new Date();
  const firstDate = shiftDate(reference, 1);
  const secondDate = shiftDate(reference, 2);

  const insertPatient = db.prepare('INSERT INTO patients (name, email, phone) VALUES (?, ?, ?)');
  const insertDoctor = db.prepare('INSERT INTO doctors (name, specialty) VALUES (?, ?)');
  const insertSlot = db.prepare(
    'INSERT INTO appointment_slots (doctor_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
  );
  const insertAppointment = db.prepare(
    'INSERT INTO appointments (patient_id, slot_id, status) VALUES (?, ?, ?)',
  );
  const insertPaymentConfig = db.prepare(
    'INSERT INTO payment_configs (consultation_type, price, payment_methods) VALUES (?, ?, ?)',
  );

  const patientIds = [
    Number(
      insertPatient.run('Ana Souza', 'ana.souza@example.com', '+5511900000001').lastInsertRowid,
    ),
    Number(
      insertPatient.run('Bruno Lima', 'bruno.lima@example.com', '+5511900000002').lastInsertRowid,
    ),
  ];

  const doctorIds = [
    Number(insertDoctor.run('Dra. Carla Mendes', 'cardiologia').lastInsertRowid),
    Number(insertDoctor.run('Dr. Diego Alves', 'dermatologia').lastInsertRowid),
  ];

  const slotIds = [
    Number(insertSlot.run(doctorIds[0], firstDate, '09:00', '09:30', 'available').lastInsertRowid),
    Number(insertSlot.run(doctorIds[0], firstDate, '10:00', '10:30', 'booked').lastInsertRowid),
    Number(insertSlot.run(doctorIds[1], secondDate, '14:00', '14:30', 'available').lastInsertRowid),
  ];

  // slotIds[1] starts pre-booked so tests and demos have a ready-made conflict scenario.
  insertAppointment.run(patientIds[1], slotIds[1], 'active');

  insertPaymentConfig.run('consultation', 250, JSON.stringify(['pix', 'credit_card', 'boleto']));
  insertPaymentConfig.run('follow_up', 150, JSON.stringify(['pix', 'credit_card']));

  return { patientIds, doctorIds, slotIds, dates: [firstDate, secondDate] };
}
