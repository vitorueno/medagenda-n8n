import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import type { Env } from './env';
import { registerErrorHandler } from './shared/error-handler';
import { authPlugin } from './shared/auth-plugin';
import { createAvailabilityCache } from './shared/cache/availability-cache';
import { registerPatientRoutes } from './modules/patients/patient.routes';
import { registerDoctorRoutes } from './modules/doctors/doctor.routes';
import { registerAvailabilityRoutes } from './modules/availability/availability.routes';
import { registerAppointmentRoutes } from './modules/appointments/appointment.routes';
import { registerPaymentRoutes } from './modules/payments/payment.routes';

export interface BuildAppDeps {
  db: Database.Database;
  env: Env;
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  void app.register(swagger, {
    openapi: { info: { title: 'Essentia Medical API', version: '1.0.0' } },
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });

  void app.register(rateLimit, {
    max: deps.env.rateLimitMax,
    timeWindow: deps.env.rateLimitTimeWindowMs,
  });

  void app.register(authPlugin, { apiKey: deps.env.apiKey });

  const availabilityCache = createAvailabilityCache(deps.env.availabilityCacheTtlSeconds);

  // Routes are registered inside a nested plugin so avvio defers their
  // registration until after the rate-limit (and swagger) plugins above have
  // actually run. Those plugins wire themselves up via an `onRoute` hook,
  // which only affects routes declared *after* the hook exists; declaring
  // routes synchronously at the top level (before the async plugins above
  // have been booted) would silently skip rate limiting for every route.
  void app.register(async (instance) => {
    registerPatientRoutes(instance, deps.db);
    registerDoctorRoutes(instance, deps.db);
    registerAvailabilityRoutes(instance, deps.db, availabilityCache);
    registerAppointmentRoutes(instance, deps.db, availabilityCache);
    registerPaymentRoutes(instance, deps.db);
  });

  return app;
}
