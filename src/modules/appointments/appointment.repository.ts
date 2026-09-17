import type Database from 'better-sqlite3';

export interface AppointmentRow {
  id: number;
  patient_id: number;
  slot_id: number;
  status: 'active' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
}

export function createAppointmentRepository(db: Database.Database) {
  const insertStmt = db.prepare(
    'INSERT INTO appointments (patient_id, slot_id, status) VALUES (?, ?, ?)',
  );
  const findByIdStmt = db.prepare(
    'SELECT id, patient_id, slot_id, status, created_at, cancelled_at FROM appointments WHERE id = ?',
  );
  const cancelStmt = db.prepare(
    "UPDATE appointments SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?",
  );

  return {
    create(patientId: number, slotId: number): AppointmentRow {
      const result = insertStmt.run(patientId, slotId, 'active');
      return findByIdStmt.get(result.lastInsertRowid) as AppointmentRow;
    },
    findById(id: number): AppointmentRow | undefined {
      return findByIdStmt.get(id) as AppointmentRow | undefined;
    },
    cancel(id: number): void {
      cancelStmt.run(id);
    },
  };
}

export type AppointmentRepository = ReturnType<typeof createAppointmentRepository>;
