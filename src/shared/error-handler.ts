import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from './errors';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }

    const isValidationError =
      error instanceof ZodError ||
      error.code === 'FST_ERR_VALIDATION' ||
      Boolean((error as { validation?: unknown }).validation);

    if (isValidationError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid request data' });
    }

    request.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });
}
