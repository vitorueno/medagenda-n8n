import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppointmentService } from './appointment.service';
import type { AppointmentRow } from './appointment.repository';
import type { SlotRepository } from '../slots/slot.repository';
import type { DoctorRepository } from '../doctors/doctor.repository';
import type {
  CreateAppointmentBody,
  AppointmentIdParams,
  BookByDetailsBody,
  CancelByPatientBody,
} from './appointment.schemas';

function toAppointmentDto(
  row: AppointmentRow,
  slotRepository: SlotRepository,
  doctorRepository: DoctorRepository,
) {
  const slot = slotRepository.findById(row.slot_id);
  const doctor = slot ? doctorRepository.findById(slot.doctor_id) : undefined;
  if (!slot || !doctor) {
    throw new Error(`Appointment ${row.id} references a missing slot or doctor`);
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    slotId: row.slot_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date: slot.date,
    startTime: slot.start_time,
    endTime: slot.end_time,
  };
}

export function createAppointmentController(
  service: AppointmentService,
  slotRepository: SlotRepository,
  doctorRepository: DoctorRepository,
) {
  const toDto = (row: AppointmentRow) => toAppointmentDto(row, slotRepository, doctorRepository);

  return {
    async create(request: FastifyRequest<{ Body: CreateAppointmentBody }>, reply: FastifyReply) {
      const appointment = service.createAppointment(request.body);
      return reply.status(201).send(toDto(appointment));
    },
    async getById(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.getAppointment(request.params.id);
      return reply.status(200).send(toDto(appointment));
    },
    async cancel(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.cancelAppointment(request.params.id);
      return reply.status(200).send(toDto(appointment));
    },
    async bookByDetails(request: FastifyRequest<{ Body: BookByDetailsBody }>, reply: FastifyReply) {
      const appointment = service.bookByDetails(request.body);
      return reply.status(201).send(toDto(appointment));
    },
    async cancelByPatient(
      request: FastifyRequest<{ Body: CancelByPatientBody }>,
      reply: FastifyReply,
    ) {
      const appointment = service.cancelByPatient(request.body);
      return reply.status(200).send(toDto(appointment));
    },
  };
}
