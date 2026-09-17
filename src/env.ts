import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1),
  API_KEY: z.string().min(16),
  AVAILABILITY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export interface Env {
  port: number;
  databasePath: string;
  apiKey: string;
  availabilityCacheTtlSeconds: number;
  rateLimitMax: number;
  rateLimitTimeWindowMs: number;
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(source);

  return {
    port: parsed.PORT,
    databasePath: parsed.DATABASE_PATH,
    apiKey: parsed.API_KEY,
    availabilityCacheTtlSeconds: parsed.AVAILABILITY_CACHE_TTL_SECONDS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitTimeWindowMs: parsed.RATE_LIMIT_TIME_WINDOW_MS,
  };
}
