import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';

describe('migrate', () => {
  it('creates all required tables', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      'appointment_slots',
      'appointments',
      'doctors',
      'patients',
      'payment_configs',
    ]);

    db.close();
  });

  it('is idempotent when run twice', () => {
    const db = createDatabase(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    db.close();
  });
});
