import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandler } from '../src/shared/error-handler';
import { PatientNotFoundError, SlotAlreadyBookedError } from '../src/shared/errors';

function buildTestServer() {
  const app = Fastify();
  registerErrorHandler(app);

  app.get('/not-found', async () => {
    throw new PatientNotFoundError('42');
  });
  app.get('/conflict', async () => {
    throw new SlotAlreadyBookedError('7');
  });
  app.get('/unexpected', async () => {
    throw new Error('boom');
  });

  return app;
}

describe('registerErrorHandler', () => {
  it('maps a not-found domain error to 404 with its code', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/not-found' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'PATIENT_NOT_FOUND' });
  });

  it('maps a conflict domain error to 409 with its code', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'SLOT_ALREADY_BOOKED' });
  });

  it('maps an unexpected error to a generic 500 without leaking details', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/unexpected' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });
});
