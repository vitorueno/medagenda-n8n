import type Database from 'better-sqlite3';

export interface DoctorRow {
  id: number;
  name: string;
  specialty: string;
}

export function createDoctorRepository(db: Database.Database) {
  const findAllStmt = db.prepare('SELECT id, name, specialty FROM doctors');

  return {
    findAll(): DoctorRow[] {
      return findAllStmt.all() as DoctorRow[];
    },
  };
}

export type DoctorRepository = ReturnType<typeof createDoctorRepository>;
