import type { FastifyInstance } from 'fastify';
import { createDatabase } from '../../src/db/connection';
import { migrate } from '../../src/db/migrate';
import { seedDatabase, type SeedResult } from '../../src/db/seed';
import { buildApp } from '../../src/server';
import type { Env } from '../../src/env';

export interface TestApp {
  app: FastifyInstance;
  seed: SeedResult;
  env: Env;
}

const TEST_API_KEY = 'test-api-key-0123456789';

// The seed derives its slot dates from "today"; pinning a reference date here
// keeps every date assertion in the suite deterministic.
const SEED_REFERENCE_DATE = new Date(2026, 8, 19);

export function buildTestApp(envOverrides: Partial<Env> = {}): TestApp {
  const db = createDatabase(':memory:');
  migrate(db);
  const seed = seedDatabase(db, { referenceDate: SEED_REFERENCE_DATE });

  const env: Env = {
    port: 0,
    databasePath: ':memory:',
    apiKey: TEST_API_KEY,
    availabilityCacheTtlSeconds: 30,
    rateLimitMax: 1000,
    rateLimitTimeWindowMs: 60_000,
    ...envOverrides,
  };

  const app = buildApp({ db, env, logger: false });

  return { app, seed, env };
}

export function authHeaders(env: Env): Record<string, string> {
  return { 'x-api-key': env.apiKey };
}
