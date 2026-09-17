import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createPatientRepository } from './patient.repository';
import { createPatientService } from './patient.service';
import { createPatientController } from './patient.controller';
import { lookupPatientQuerySchema, patientResponseSchema } from './patient.schemas';

export function registerPatientRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createPatientRepository(db);
  const service = createPatientService(repository);
  const controller = createPatientController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/patients/lookup',
    {
      schema: {
        querystring: lookupPatientQuerySchema,
        response: { 200: patientResponseSchema },
      },
    },
    controller.lookup,
  );
}
