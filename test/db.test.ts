import { describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

describe('createDatabase', () => {
  it('creates the parent directory when it does not exist yet', () => {
    const tempDir = join(tmpdir(), `essentia-test-${Date.now()}`);
    const dbPath = join(tempDir, 'nested', 'dev.db');

    expect(existsSync(dbPath)).toBe(false);

    let db: ReturnType<typeof createDatabase> | undefined;
    try {
      expect(() => {
        db = createDatabase(dbPath);
      }).not.toThrow();
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      db?.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
