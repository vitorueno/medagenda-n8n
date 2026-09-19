import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import {
  jsonSchemaTransform,
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
  logger?: boolean;
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  void app.register(swagger, {
    openapi: {
      info: { title: 'Assistente de Agendamento Medico - API', version: '1.0.0' },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
          },
        },
      },
      security: [{ apiKey: [] }],
    },
    transform: jsonSchemaTransform,
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });

  void app.register(rateLimit, {
    max: deps.env.rateLimitMax,
    timeWindow: deps.env.rateLimitTimeWindowMs,
  });

  void app.register(authPlugin, { apiKey: deps.env.apiKey });

  const availabilityCache = createAvailabilityCache(deps.env.availabilityCacheTtlSeconds);

  // Rate limit and swagger attach themselves through an `onRoute` hook, which
  // only sees routes declared after the hook exists. Nesting the routes in
  // their own plugin defers them until those plugins have booted.
  void app.register(async (instance) => {
    registerPatientRoutes(instance, deps.db);
    registerDoctorRoutes(instance, deps.db);
    registerAvailabilityRoutes(instance, deps.db, availabilityCache);
    registerAppointmentRoutes(instance, deps.db, availabilityCache);
    registerPaymentRoutes(instance, deps.db);
  });

  return app;
}
