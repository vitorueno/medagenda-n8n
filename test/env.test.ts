import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';

describe('loadEnv', () => {
  it('parses required values and applies defaults', () => {
    const env = loadEnv({
      DATABASE_PATH: './data/dev.db',
      API_KEY: 'a'.repeat(16),
    });

    expect(env).toEqual({
      port: 3000,
      databasePath: './data/dev.db',
      apiKey: 'a'.repeat(16),
      availabilityCacheTtlSeconds: 30,
      rateLimitMax: 100,
      rateLimitTimeWindowMs: 60_000,
    });
  });

  it('overrides defaults when variables are provided', () => {
    const env = loadEnv({
      PORT: '4000',
      DATABASE_PATH: './data/dev.db',
      API_KEY: 'a'.repeat(16),
      AVAILABILITY_CACHE_TTL_SECONDS: '10',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_TIME_WINDOW_MS: '1000',
    });

    expect(env.port).toBe(4000);
    expect(env.availabilityCacheTtlSeconds).toBe(10);
    expect(env.rateLimitMax).toBe(5);
    expect(env.rateLimitTimeWindowMs).toBe(1000);
  });

  it('throws when a required variable is missing', () => {
    expect(() => loadEnv({})).toThrow();
  });

  it('throws when API_KEY is too short', () => {
    expect(() => loadEnv({ DATABASE_PATH: './data/dev.db', API_KEY: 'short' })).toThrow();
  });
});
