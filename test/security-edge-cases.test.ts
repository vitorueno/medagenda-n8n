import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('security and edge cases', () => {
  it('rejects an oversized name-like field via strict schema (extra field)', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        slotId: seed.slotIds[0],
        notes: 'x'.repeat(10_000),
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a wrong-typed field', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: { $ne: null }, slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('treats a SQL-injection-shaped email as a literal value and returns 404, not a server error', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: `/patients/lookup?email=${encodeURIComponent("admin'--@example.com")}`,
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('rejects an overly long phone value', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: `/patients/lookup?phone=${'1'.repeat(50)}`,
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('enforces the rate limit once the configured maximum is exceeded', async () => {
    const { app, env } = buildTestApp({ rateLimitMax: 2, rateLimitTimeWindowMs: 60_000 });

    await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });
    await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });
    const third = await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });

    expect(third.statusCode).toBe(429);
    await app.close();
  });

  it('rejects a boolean patientId instead of silently coercing it to a number', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: true, slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects an array patientId instead of silently coercing it to a number', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: [1], slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('never leaks internal error details to the client', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/appointments/not-a-number',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.stringify(response.json())).not.toMatch(/at .*\.ts:\d+/);
    await app.close();
  });
});
