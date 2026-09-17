import type Database from 'better-sqlite3';

export interface PatientRow {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export function createPatientRepository(db: Database.Database) {
  const findByEmailStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE email = ?');
  const findByPhoneStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE phone = ?');
  const findByIdStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE id = ?');

  return {
    findByEmail(email: string): PatientRow | undefined {
      return findByEmailStmt.get(email) as PatientRow | undefined;
    },
    findByPhone(phone: string): PatientRow | undefined {
      return findByPhoneStmt.get(phone) as PatientRow | undefined;
    },
    findById(id: number): PatientRow | undefined {
      return findByIdStmt.get(id) as PatientRow | undefined;
    },
  };
}

export type PatientRepository = ReturnType<typeof createPatientRepository>;
