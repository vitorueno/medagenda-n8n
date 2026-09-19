import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppointmentService } from './appointment.service';
import type { AppointmentRow } from './appointment.repository';
import type {
  CreateAppointmentBody,
  AppointmentIdParams,
  BookByDetailsBody,
  CancelByPatientBody,
} from './appointment.schemas';

function toAppointmentDto(row: AppointmentRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    slotId: row.slot_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export function createAppointmentController(service: AppointmentService) {
  return {
    async create(request: FastifyRequest<{ Body: CreateAppointmentBody }>, reply: FastifyReply) {
      const appointment = service.createAppointment(request.body);
      return reply.status(201).send(toAppointmentDto(appointment));
    },
    async getById(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.getAppointment(request.params.id);
      return reply.status(200).send(toAppointmentDto(appointment));
    },
    async cancel(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.cancelAppointment(request.params.id);
      return reply.status(200).send(toAppointmentDto(appointment));
    },
    async bookByDetails(request: FastifyRequest<{ Body: BookByDetailsBody }>, reply: FastifyReply) {
      const appointment = service.bookByDetails(request.body);
      return reply.status(201).send(toAppointmentDto(appointment));
    },
    async cancelByPatient(
      request: FastifyRequest<{ Body: CancelByPatientBody }>,
      reply: FastifyReply,
    ) {
      const appointment = service.cancelByPatient(request.body);
      return reply.status(200).send(toAppointmentDto(appointment));
    },
  };
}
