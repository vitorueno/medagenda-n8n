import type Database from 'better-sqlite3';
import type { AppointmentRepository, AppointmentRow } from './appointment.repository';
import type { SlotRepository } from '../slots/slot.repository';
import type { PatientRepository } from '../patients/patient.repository';
import type { DoctorService } from '../doctors/doctor.service';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';
import {
  PatientNotFoundError,
  SlotNotFoundError,
  SlotAlreadyBookedError,
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
  MultipleActiveAppointmentsError,
} from '../../shared/errors';

export interface CreateAppointmentParams {
  patientId: number;
  slotId: number;
}

export interface BookByDetailsParams {
  patientId: number;
  doctorName?: string;
  specialty?: string;
  date: string;
  startTime: string;
}

export interface CancelByPatientParams {
  patientId: number;
  date?: string;
  startTime?: string;
}

export interface AppointmentDependencies {
  db: Database.Database;
  appointmentRepository: AppointmentRepository;
  slotRepository: SlotRepository;
  patientRepository: PatientRepository;
  doctorService: DoctorService;
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
    bookByDetails(params: BookByDetailsParams): AppointmentRow {
      const doctor = deps.doctorService.resolveDoctor({
        name: params.doctorName,
        specialty: params.specialty,
      });

      const slots = deps.slotRepository.findAvailable({
        date: params.date,
        doctorId: doctor.id,
      });
      const slot = slots.find((candidate) => candidate.startTime === params.startTime);

      if (!slot) {
        throw new SlotNotFoundError(`${doctor.name} ${params.date} ${params.startTime}`);
      }

      const appointment = createTransaction({ patientId: params.patientId, slotId: slot.id });
      deps.availabilityCache.invalidateDate(params.date);
      return appointment;
    },
    cancelByPatient(params: CancelByPatientParams): AppointmentRow {
      const active = deps.appointmentRepository.findActiveByPatient(params.patientId);
      const candidates = active.filter((appointment) => {
        const slot = deps.slotRepository.findById(appointment.slot_id);
        if (!slot) {
          return false;
        }
        if (params.date && slot.date !== params.date) {
          return false;
        }
        if (params.startTime && slot.start_time !== params.startTime) {
          return false;
        }
        return true;
      });

      const identifier = [`patient ${params.patientId}`, params.date, params.startTime]
        .filter(Boolean)
        .join(' ');

      if (candidates.length > 1) {
        throw new MultipleActiveAppointmentsError(identifier);
      }

      const [match] = candidates;
      if (!match) {
        throw new AppointmentNotFoundError(identifier);
      }

      return this.cancelAppointment(match.id);
    },
  };
}

export type AppointmentService = ReturnType<typeof createAppointmentService>;
