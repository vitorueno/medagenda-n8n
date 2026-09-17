import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AvailabilityService } from './availability.service';
import type { AvailabilityQuery } from './availability.schemas';

export function createAvailabilityController(service: AvailabilityService) {
  return {
    async list(request: FastifyRequest<{ Querystring: AvailabilityQuery }>, reply: FastifyReply) {
      const slots = service.getAvailability(request.query);
      return reply.status(200).send(slots);
    },
  };
}
