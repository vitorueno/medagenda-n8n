import type { SlotRepository, AvailableSlotView } from '../slots/slot.repository';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';
import type { AvailabilityQuery } from './availability.schemas';

function buildCacheKey(query: AvailabilityQuery): string {
  return `${query.date}|${query.doctorId ?? ''}|${query.specialty ?? ''}`;
}

export function createAvailabilityService(repository: SlotRepository, cache: AvailabilityCache) {
  return {
    getAvailability(query: AvailabilityQuery): AvailableSlotView[] {
      const cacheKey = buildCacheKey(query);
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const slots = repository.findAvailable(query);
      cache.set(cacheKey, slots);
      return slots;
    },
  };
}

export type AvailabilityService = ReturnType<typeof createAvailabilityService>;
