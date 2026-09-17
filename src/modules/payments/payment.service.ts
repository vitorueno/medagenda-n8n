import type { PaymentRepository, PaymentConfigRow } from './payment.repository';
import { PaymentConfigNotFoundError } from '../../shared/errors';

export interface PaymentConfig {
  id: number;
  consultationType: string;
  price: number;
  paymentMethods: string[];
}

function toPaymentConfig(row: PaymentConfigRow): PaymentConfig {
  return {
    id: row.id,
    consultationType: row.consultation_type,
    price: row.price,
    paymentMethods: JSON.parse(row.payment_methods) as string[],
  };
}

export function createPaymentService(repository: PaymentRepository) {
  return {
    listPayments(consultationType?: string): PaymentConfig[] {
      if (consultationType) {
        const row = repository.findByType(consultationType);
        if (!row) {
          throw new PaymentConfigNotFoundError(consultationType);
        }
        return [toPaymentConfig(row)];
      }
      return repository.findAll().map(toPaymentConfig);
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
