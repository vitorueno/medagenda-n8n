import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments/:id/cancel', () => {
  it('cancels an active appointment and frees its slot', async () => {
    const { app, seed, env } = buildTestApp();

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });
    const appointmentId = (bookResponse.json() as { id: number }).id;

    const beforeCancel = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(beforeCancel.json()).toHaveLength(0);

    const cancelResponse = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: authHeaders(env),
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json()).toMatchObject({ status: 'cancelled' });

    const afterCancel = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(afterCancel.json()).toHaveLength(1);

    await app.close();
  });

  it('returns 404 for a non-existent appointment', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/999999/cancel',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 409 when cancelling an already-cancelled appointment', async () => {
    const { app, seed, env } = buildTestApp();

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });
    const appointmentId = (bookResponse.json() as { id: number }).id;

    await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: authHeaders(env),
    });
    const secondCancel = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: authHeaders(env),
    });

    expect(secondCancel.statusCode).toBe(409);
    await app.close();
  });
});
