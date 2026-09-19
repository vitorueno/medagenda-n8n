import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { createSlotRepository } from '../src/modules/slots/slot.repository';

function setup() {
  const db = createDatabase(':memory:');
  migrate(db);
  const seed = seedDatabase(db);
  return { db, seed, repository: createSlotRepository(db) };
}

describe('slotRepository', () => {
  it('finds a slot by id', () => {
    const { repository, seed } = setup();
    const slot = repository.findById(seed.slotIds[0]);
    expect(slot).toMatchObject({ status: 'available' });
  });

  it('returns undefined for a missing id', () => {
    const { repository } = setup();
    expect(repository.findById(999_999)).toBeUndefined();
  });

  it('updates a slot status', () => {
    const { repository, seed } = setup();
    repository.markStatus(seed.slotIds[0], 'booked');
    expect(repository.findById(seed.slotIds[0])?.status).toBe('booked');
  });

  it('finds available slots for a date, excluding booked ones', () => {
    const { repository, seed } = setup();
    const slots = repository.findAvailable({ date: seed.dates[0] as string });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: seed.dates[0], specialty: 'cardiologia' });
  });

  it('filters by doctorId', () => {
    const { repository, seed } = setup();
    const slots = repository.findAvailable({
      date: seed.dates[1] as string,
      doctorId: seed.doctorIds[1],
    });
    expect(slots).toHaveLength(1);
  });

  it('filters by specialty', () => {
    const { repository, seed } = setup();
    const slots = repository.findAvailable({
      date: seed.dates[1] as string,
      specialty: 'dermatologia',
    });
    expect(slots).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    const { repository } = setup();
    expect(repository.findAvailable({ date: '2099-01-01' })).toEqual([]);
  });
});
