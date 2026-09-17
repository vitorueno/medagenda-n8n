import type { PatientRepository, PatientRow } from './patient.repository';
import { PatientNotFoundError } from '../../shared/errors';

export interface LookupPatientParams {
  email?: string;
  phone?: string;
}

export function createPatientService(repository: PatientRepository) {
  return {
    lookupPatient(params: LookupPatientParams): PatientRow {
      const patient = params.email
        ? repository.findByEmail(params.email)
        : params.phone
          ? repository.findByPhone(params.phone)
          : undefined;

      if (!patient) {
        throw new PatientNotFoundError(params.email ?? params.phone ?? 'unknown');
      }

      return patient;
    },
  };
}

export type PatientService = ReturnType<typeof createPatientService>;
