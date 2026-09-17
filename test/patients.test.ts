import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /patients/lookup', () => {
  it('finds a patient by email', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: seed.patientIds[0],
      email: 'ana.souza@example.com',
    });
    await app.close();
  });

  it('finds a patient by phone', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?phone=%2B5511900000002',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Bruno Lima' });
    await app.close();
  });

  it('returns 404 when no patient matches', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=unknown@example.com',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 400 when neither email nor phone is provided', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when an unknown query field is provided', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com&unexpected=1',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 401 without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com',
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
