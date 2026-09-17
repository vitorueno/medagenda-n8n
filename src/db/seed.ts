import type Database from 'better-sqlite3';

export interface SeedResult {
  patientIds: number[];
  doctorIds: number[];
  slotIds: number[];
}

export function seedDatabase(db: Database.Database): SeedResult {
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
    Number(insertDoctor.run('Dra. Carla Mendes', 'cardiology').lastInsertRowid),
    Number(insertDoctor.run('Dr. Diego Alves', 'dermatology').lastInsertRowid),
  ];

  const slotIds = [
    Number(
      insertSlot.run(doctorIds[0], '2026-09-20', '09:00', '09:30', 'available').lastInsertRowid,
    ),
    Number(insertSlot.run(doctorIds[0], '2026-09-20', '10:00', '10:30', 'booked').lastInsertRowid),
    Number(
      insertSlot.run(doctorIds[1], '2026-09-21', '14:00', '14:30', 'available').lastInsertRowid,
    ),
  ];

  // slotIds[1] starts pre-booked so tests and demos have a ready-made conflict scenario.
  insertAppointment.run(patientIds[1], slotIds[1], 'active');

  insertPaymentConfig.run('consultation', 250, JSON.stringify(['pix', 'credit_card', 'boleto']));
  insertPaymentConfig.run('follow_up', 150, JSON.stringify(['pix', 'credit_card']));

  return { patientIds, doctorIds, slotIds };
}
