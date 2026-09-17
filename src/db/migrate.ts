import type Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

export function migrate(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}
