import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createPaymentRepository } from './payment.repository';
import { createPaymentService } from './payment.service';
import { createPaymentController } from './payment.controller';
import { listPaymentsQuerySchema, listPaymentsResponseSchema } from './payment.schemas';

export function registerPaymentRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createPaymentRepository(db);
  const service = createPaymentService(repository);
  const controller = createPaymentController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/payments',
    {
      schema: {
        querystring: listPaymentsQuerySchema,
        response: { 200: listPaymentsResponseSchema },
      },
    },
    controller.list,
  );
}
