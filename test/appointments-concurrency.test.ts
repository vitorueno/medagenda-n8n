import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('concurrent booking of the same slot', () => {
  it('only lets one of two simultaneous requests succeed', async () => {
    const { app, seed, env } = buildTestApp();

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeaders(env),
        payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
      }),
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeaders(env),
        payload: { patientId: seed.patientIds[1], slotId: seed.slotIds[0] },
      }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    const availabilityResponse = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(availabilityResponse.json()).toEqual([]);

    await app.close();
  });
});
