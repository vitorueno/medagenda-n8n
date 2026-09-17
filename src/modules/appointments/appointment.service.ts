import type Database from 'better-sqlite3';
import type { AppointmentRepository, AppointmentRow } from './appointment.repository';
import type { SlotRepository } from '../slots/slot.repository';
import type { PatientRepository } from '../patients/patient.repository';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';
import {
  PatientNotFoundError,
  SlotNotFoundError,
  SlotAlreadyBookedError,
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
} from '../../shared/errors';

export interface CreateAppointmentParams {
  patientId: number;
  slotId: number;
}

export interface AppointmentDependencies {
  db: Database.Database;
  appointmentRepository: AppointmentRepository;
  slotRepository: SlotRepository;
  patientRepository: PatientRepository;
  availabilityCache: AvailabilityCache;
}

export function createAppointmentService(deps: AppointmentDependencies) {
  // better-sqlite3 transactions run synchronously, so no other request can
  // interleave between the availability check and the write below.
  const createTransaction = deps.db.transaction(
    (params: CreateAppointmentParams): AppointmentRow => {
      const patient = deps.patientRepository.findById(params.patientId);
      if (!patient) {
        throw new PatientNotFoundError(String(params.patientId));
      }

      const slot = deps.slotRepository.findById(params.slotId);
      if (!slot) {
        throw new SlotNotFoundError(String(params.slotId));
      }

      if (slot.status !== 'available') {
        throw new SlotAlreadyBookedError(String(params.slotId));
      }

      deps.slotRepository.markStatus(params.slotId, 'booked');
      return deps.appointmentRepository.create(params.patientId, params.slotId);
    },
  );

  const cancelTransaction = deps.db.transaction((appointmentId: number): AppointmentRow => {
    const appointment = deps.appointmentRepository.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentNotFoundError(String(appointmentId));
    }

    if (appointment.status === 'cancelled') {
      throw new AppointmentAlreadyCancelledError(String(appointmentId));
    }

    deps.appointmentRepository.cancel(appointmentId);
    deps.slotRepository.markStatus(appointment.slot_id, 'available');

    return deps.appointmentRepository.findById(appointmentId) as AppointmentRow;
  });

  return {
    createAppointment(params: CreateAppointmentParams): AppointmentRow {
      const appointment = createTransaction(params);
      const slot = deps.slotRepository.findById(appointment.slot_id);
      if (slot) {
        deps.availabilityCache.invalidateDate(slot.date);
      }
      return appointment;
    },
    getAppointment(id: number): AppointmentRow {
      const appointment = deps.appointmentRepository.findById(id);
      if (!appointment) {
        throw new AppointmentNotFoundError(String(id));
      }
      return appointment;
    },
    cancelAppointment(id: number): AppointmentRow {
      const appointment = cancelTransaction(id);
      const slot = deps.slotRepository.findById(appointment.slot_id);
      if (slot) {
        deps.availabilityCache.invalidateDate(slot.date);
      }
      return appointment;
    },
  };
}

export type AppointmentService = ReturnType<typeof createAppointmentService>;
