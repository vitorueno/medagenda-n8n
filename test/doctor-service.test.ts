import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { createDoctorRepository } from '../src/modules/doctors/doctor.repository';
import { createDoctorService } from '../src/modules/doctors/doctor.service';
import { DoctorAmbiguousError, DoctorNotFoundError } from '../src/shared/errors';

function buildService() {
  const db = createDatabase(':memory:');
  migrate(db);
  seedDatabase(db);
  return createDoctorService(createDoctorRepository(db));
}

describe('doctorService.resolveDoctor', () => {
  it('resolves by exact name', () => {
    const service = buildService();
    const doctor = service.resolveDoctor({ name: 'Dra. Carla Mendes' });
    expect(doctor.specialty).toBe('cardiology');
  });

  it('resolves regardless of accents, case, or "Dr./Dra." prefix', () => {
    const service = buildService();
    const doctor = service.resolveDoctor({ name: 'diego alves' });
    expect(doctor.specialty).toBe('dermatology');
  });

  it('resolves by specialty when no name is given', () => {
    const service = buildService();
    const doctor = service.resolveDoctor({ specialty: 'dermatology' });
    expect(doctor.name).toBe('Dr. Diego Alves');
  });

  it('throws DoctorNotFoundError when nothing matches', () => {
    const service = buildService();
    expect(() => service.resolveDoctor({ name: 'Dr. Ninguem' })).toThrow(DoctorNotFoundError);
  });

  it('throws DoctorAmbiguousError when name is omitted and specialty matches more than one doctor', () => {
    const db = createDatabase(':memory:');
    migrate(db);
    seedDatabase(db);
    db.prepare('INSERT INTO doctors (name, specialty) VALUES (?, ?)').run(
      'Dr. Bruno Cardoso',
      'cardiology',
    );
    const service = createDoctorService(createDoctorRepository(db));

    expect(() => service.resolveDoctor({ specialty: 'cardiology' })).toThrow(DoctorAmbiguousError);
  });
});
