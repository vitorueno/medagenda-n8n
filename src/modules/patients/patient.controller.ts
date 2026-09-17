import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PatientService } from './patient.service';
import type { LookupPatientQuery } from './patient.schemas';

export function createPatientController(service: PatientService) {
  return {
    async lookup(
      request: FastifyRequest<{ Querystring: LookupPatientQuery }>,
      reply: FastifyReply,
    ) {
      const patient = service.lookupPatient(request.query);
      return reply.status(200).send(patient);
    },
  };
}
