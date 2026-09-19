import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createAppointmentRepository } from './appointment.repository';
import { createSlotRepository } from '../slots/slot.repository';
import { createPatientRepository } from '../patients/patient.repository';
import { createDoctorRepository } from '../doctors/doctor.repository';
import { createDoctorService } from '../doctors/doctor.service';
import { createAppointmentService } from './appointment.service';
import { createAppointmentController } from './appointment.controller';
import {
  createAppointmentBodySchema,
  appointmentResponseSchema,
  appointmentIdParamsSchema,
  bookByDetailsBodySchema,
  cancelByPatientBodySchema,
} from './appointment.schemas';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';

export function registerAppointmentRoutes(
  app: FastifyInstance,
  db: Database.Database,
  availabilityCache: AvailabilityCache,
): void {
  const slotRepository = createSlotRepository(db);
  const doctorRepository = createDoctorRepository(db);
  const service = createAppointmentService({
    db,
    appointmentRepository: createAppointmentRepository(db),
    slotRepository,
    patientRepository: createPatientRepository(db),
    doctorService: createDoctorService(doctorRepository),
    availabilityCache,
  });
  const controller = createAppointmentController(service, slotRepository, doctorRepository);
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

  typedApp.post(
    '/appointments/by-details',
    { schema: { body: bookByDetailsBodySchema, response: { 201: appointmentResponseSchema } } },
    controller.bookByDetails,
  );

  typedApp.post(
    '/appointments/cancel-by-patient',
    { schema: { body: cancelByPatientBodySchema, response: { 200: appointmentResponseSchema } } },
    controller.cancelByPatient,
  );
}
