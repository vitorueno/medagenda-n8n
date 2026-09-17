export interface CachedSlot {
  id: number;
  doctorId: number;
  doctorName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CacheEntry {
  value: CachedSlot[];
  expiresAt: number;
}

export function createAvailabilityCache(ttlSeconds: number) {
  const store = new Map<string, CacheEntry>();

  return {
    get(key: string): CachedSlot[] | undefined {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: CachedSlot[]): void {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    invalidateDate(date: string): void {
      for (const key of store.keys()) {
        if (key.startsWith(`${date}|`)) {
          store.delete(key);
        }
      }
    },
  };
}

export type AvailabilityCache = ReturnType<typeof createAvailabilityCache>;
