import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DoctorService } from './doctor.service';

export function createDoctorController(service: DoctorService) {
  return {
    async list(_request: FastifyRequest, reply: FastifyReply) {
      return reply.status(200).send(service.listDoctors());
    },
  };
}
