import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createAppointmentRepository } from './appointment.repository';
import { createSlotRepository } from '../slots/slot.repository';
import { createPatientRepository } from '../patients/patient.repository';
import { createAppointmentService } from './appointment.service';
import { createAppointmentController } from './appointment.controller';
import {
  createAppointmentBodySchema,
  appointmentResponseSchema,
  appointmentIdParamsSchema,
} from './appointment.schemas';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';

export function registerAppointmentRoutes(
  app: FastifyInstance,
  db: Database.Database,
  availabilityCache: AvailabilityCache,
): void {
  const service = createAppointmentService({
    db,
    appointmentRepository: createAppointmentRepository(db),
    slotRepository: createSlotRepository(db),
    patientRepository: createPatientRepository(db),
    availabilityCache,
  });
  const controller = createAppointmentController(service);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/appointments',
    { schema: { body: createAppointmentBodySchema, response: { 201: appointmentResponseSchema } } },
    controller.create,
  );

  typedApp.get(
    '/appointments/:id',
    { schema: { params: appointmentIdParamsSchema, response: { 200: appointmentResponseSchema } } },
    controller.getById,
  );

  typedApp.post(
    '/appointments/:id/cancel',
    { schema: { params: appointmentIdParamsSchema, response: { 200: appointmentResponseSchema } } },
    controller.cancel,
  );
}
