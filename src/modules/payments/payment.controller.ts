import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PaymentService } from './payment.service';
import type { ListPaymentsQuery } from './payment.schemas';

export function createPaymentController(service: PaymentService) {
  return {
    async list(request: FastifyRequest<{ Querystring: ListPaymentsQuery }>, reply: FastifyReply) {
      const payments = service.listPayments(request.query.consultationType);
      return reply.status(200).send(payments);
    },
  };
}
