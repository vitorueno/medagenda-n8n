import { describe, expect, it, vi } from 'vitest';
import { createAvailabilityCache } from '../src/shared/cache/availability-cache';

const sampleSlot = {
  id: 1,
  doctorId: 1,
  doctorName: 'Dra. Carla Mendes',
  specialty: 'cardiology',
  date: '2026-09-20',
  startTime: '09:00',
  endTime: '09:30',
};

describe('createAvailabilityCache', () => {
  it('returns undefined for a missing key', () => {
    const cache = createAvailabilityCache(30);
    expect(cache.get('2026-09-20||')).toBeUndefined();
  });

  it('returns a cached value before it expires', () => {
    const cache = createAvailabilityCache(30);
    cache.set('2026-09-20||', [sampleSlot]);
    expect(cache.get('2026-09-20||')).toEqual([sampleSlot]);
  });

  it('expires entries after the ttl', () => {
    vi.useFakeTimers();
    const cache = createAvailabilityCache(1);
    cache.set('2026-09-20||', [sampleSlot]);
    vi.advanceTimersByTime(1_001);
    expect(cache.get('2026-09-20||')).toBeUndefined();
    vi.useRealTimers();
  });

  it('invalidates every key for a given date, regardless of filters', () => {
    const cache = createAvailabilityCache(30);
    cache.set('2026-09-20|1|', [sampleSlot]);
    cache.set('2026-09-20||cardiology', [sampleSlot]);
    cache.set('2026-09-21||', [sampleSlot]);

    cache.invalidateDate('2026-09-20');

    expect(cache.get('2026-09-20|1|')).toBeUndefined();
    expect(cache.get('2026-09-20||cardiology')).toBeUndefined();
    expect(cache.get('2026-09-21||')).toEqual([sampleSlot]);
  });
});
