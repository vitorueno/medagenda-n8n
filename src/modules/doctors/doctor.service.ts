import type { DoctorRepository } from './doctor.repository';

export function createDoctorService(repository: DoctorRepository) {
  return {
    listDoctors() {
      return repository.findAll();
    },
  };
}

export type DoctorService = ReturnType<typeof createDoctorService>;
