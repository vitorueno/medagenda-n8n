import type Database from 'better-sqlite3';

export interface DoctorRow {
  id: number;
  name: string;
  specialty: string;
}

export function createDoctorRepository(db: Database.Database) {
  const findAllStmt = db.prepare('SELECT id, name, specialty FROM doctors');
  const findByIdStmt = db.prepare('SELECT id, name, specialty FROM doctors WHERE id = ?');

  return {
    findAll(): DoctorRow[] {
      return findAllStmt.all() as DoctorRow[];
    },
    findById(id: number): DoctorRow | undefined {
      return findByIdStmt.get(id) as DoctorRow | undefined;
    },
  };
}

export type DoctorRepository = ReturnType<typeof createDoctorRepository>;
