import type Database from 'better-sqlite3';
import { normalizeText } from '../../shared/normalize';

export interface SlotRow {
  id: number;
  doctor_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
}

export interface AvailableSlotView {
  id: number;
  doctorId: number;
  doctorName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityFilters {
  date: string;
  doctorId?: number;
  specialty?: string;
}

export function createSlotRepository(db: Database.Database) {
  const findByIdStmt = db.prepare(
    'SELECT id, doctor_id, date, start_time, end_time, status FROM appointment_slots WHERE id = ?',
  );
  const markStatusStmt = db.prepare('UPDATE appointment_slots SET status = ? WHERE id = ?');

  return {
    findById(id: number): SlotRow | undefined {
      return findByIdStmt.get(id) as SlotRow | undefined;
    },
    markStatus(id: number, status: 'available' | 'booked'): void {
      markStatusStmt.run(status, id);
    },
    findAvailable(filters: AvailabilityFilters): AvailableSlotView[] {
      const conditions = ['s.status = ?', 's.date = ?'];
      const params: Array<string | number> = ['available', filters.date];

      if (filters.doctorId !== undefined) {
        conditions.push('d.id = ?');
        params.push(filters.doctorId);
      }

      const query = `
        SELECT s.id as id, d.id as doctorId, d.name as doctorName, d.specialty as specialty,
               s.date as date, s.start_time as startTime, s.end_time as endTime
        FROM appointment_slots s
        JOIN doctors d ON d.id = s.doctor_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.start_time ASC
      `;

      const slots = db.prepare(query).all(...params) as AvailableSlotView[];

      if (filters.specialty === undefined) {
        return slots;
      }

      // Patients type the specialty the way they say it ("Dermatologia"), so it
      // is matched case- and accent-insensitively rather than by SQL equality.
      const normalized = normalizeText(filters.specialty);
      return slots.filter((slot) => normalizeText(slot.specialty) === normalized);
    },
  };
}

export type SlotRepository = ReturnType<typeof createSlotRepository>;
