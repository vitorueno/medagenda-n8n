import type Database from 'better-sqlite3';

export interface PaymentConfigRow {
  id: number;
  consultation_type: string;
  price: number;
  payment_methods: string;
}

export function createPaymentRepository(db: Database.Database) {
  const findAllStmt = db.prepare(
    'SELECT id, consultation_type, price, payment_methods FROM payment_configs',
  );
  const findByTypeStmt = db.prepare(
    'SELECT id, consultation_type, price, payment_methods FROM payment_configs WHERE consultation_type = ?',
  );

  return {
    findAll(): PaymentConfigRow[] {
      return findAllStmt.all() as PaymentConfigRow[];
    },
    findByType(type: string): PaymentConfigRow | undefined {
      return findByTypeStmt.get(type) as PaymentConfigRow | undefined;
    },
  };
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;
