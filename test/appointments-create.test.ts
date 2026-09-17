import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments', () => {
  it('books an available slot', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      patientId: seed.patientIds[0],
      slotId: seed.slotIds[0],
      status: 'active',
    });
    await app.close();
  });

  it('returns 409 when the slot is already booked', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[1] },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('returns 404 when the slot does not exist', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: 999_999 },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 when the patient does not exist', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: 999_999, slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 400 for a non-numeric patientId', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: 'not-a-number', slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('invalidates the availability cache for the booked date', async () => {
    const { app, seed, env } = buildTestApp();

    const before = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(before.json()).toHaveLength(1);

    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(after.json()).toHaveLength(0);

    await app.close();
  });
});

describe('GET /appointments/:id', () => {
  it('returns 404 for a non-existent appointment', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/appointments/999999',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
