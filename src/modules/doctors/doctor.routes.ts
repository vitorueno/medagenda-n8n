import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createDoctorRepository } from './doctor.repository';
import { createDoctorService } from './doctor.service';
import { createDoctorController } from './doctor.controller';
import { listDoctorsResponseSchema } from './doctor.schemas';

export function registerDoctorRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createDoctorRepository(db);
  const service = createDoctorService(repository);
  const controller = createDoctorController(service);

  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/doctors', { schema: { response: { 200: listDoctorsResponseSchema } } }, controller.list);
}
