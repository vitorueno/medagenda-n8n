import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createSlotRepository } from '../slots/slot.repository';
import { createAvailabilityService } from './availability.service';
import { createAvailabilityController } from './availability.controller';
import { availabilityQuerySchema, availabilityResponseSchema } from './availability.schemas';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  db: Database.Database,
  cache: AvailabilityCache,
): void {
  const repository = createSlotRepository(db);
  const service = createAvailabilityService(repository, cache);
  const controller = createAvailabilityController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/availability',
    {
      schema: {
        querystring: availabilityQuerySchema,
        response: { 200: availabilityResponseSchema },
      },
    },
    controller.list,
  );
}
