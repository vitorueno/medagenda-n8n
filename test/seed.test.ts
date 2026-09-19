import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';

describe('seedDatabase', () => {
  it('inserts patients, doctors, slots, an existing booking and payment configs', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    const result = seedDatabase(db);

    expect(result.patientIds).toHaveLength(2);
    expect(result.doctorIds).toHaveLength(2);
    expect(result.slotIds).toHaveLength(3);

    const patientCount = (
      db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number }
    ).count;
    const bookedSlot = db
      .prepare('SELECT status FROM appointment_slots WHERE id = ?')
      .get(result.slotIds[1]) as { status: string };
    const activeAppointments = (
      db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'active'").get() as {
        count: number;
      }
    ).count;
    const paymentConfigCount = (
      db.prepare('SELECT COUNT(*) as count FROM payment_configs').get() as { count: number }
    ).count;

    expect(patientCount).toBe(2);
    expect(bookedSlot.status).toBe('booked');
    expect(activeAppointments).toBe(1);
    expect(paymentConfigCount).toBe(2);

    db.close();
  });

  it('places every slot in the future relative to the reference date', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    seedDatabase(db, { referenceDate: new Date(2030, 0, 31) });

    const dates = (
      db.prepare('SELECT DISTINCT date FROM appointment_slots ORDER BY date').all() as {
        date: string;
      }[]
    ).map((row) => row.date);

    expect(dates).toEqual(['2030-02-01', '2030-02-02']);

    db.close();
  });

  it('defaults to dates in the future when no reference date is given', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    seedDatabase(db);

    const earliest = db.prepare('SELECT MIN(date) as date FROM appointment_slots').get() as {
      date: string;
    };
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(earliest.date > todayIso).toBe(true);

    db.close();
  });
});
