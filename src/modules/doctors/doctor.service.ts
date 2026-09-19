import type { DoctorRepository, DoctorRow } from './doctor.repository';
import { normalizeName } from '../../shared/normalize';
import { DoctorAmbiguousError, DoctorNotFoundError } from '../../shared/errors';

export interface ResolveDoctorParams {
  name?: string;
  specialty?: string;
}

export function createDoctorService(repository: DoctorRepository) {
  return {
    listDoctors() {
      return repository.findAll();
    },
    resolveDoctor(params: ResolveDoctorParams): DoctorRow {
      const doctors = repository.findAll();
      let candidates = doctors;

      if (params.name) {
        const normalized = normalizeName(params.name);
        candidates = candidates.filter((doctor) => normalizeName(doctor.name) === normalized);
      }

      if (params.specialty) {
        candidates = candidates.filter((doctor) => doctor.specialty === params.specialty);
      }

      const identifier = params.name ?? params.specialty ?? 'unspecified';

      if (candidates.length > 1) {
        throw new DoctorAmbiguousError(identifier);
      }

      const [doctor] = candidates;
      if (!doctor) {
        throw new DoctorNotFoundError(identifier);
      }

      return doctor;
    },
  };
}

export type DoctorService = ReturnType<typeof createDoctorService>;
