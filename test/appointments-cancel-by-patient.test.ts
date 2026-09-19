import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments/cancel-by-patient', () => {
  it('cancels the single active appointment for a patient', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      patientId: seed.patientIds[1],
      status: 'cancelled',
      doctorName: 'Dra. Carla Mendes',
      specialty: 'cardiology',
      date: '2026-09-20',
      startTime: '10:00',
      endTime: '10:30',
    });
    await app.close();
  });

  it('disambiguates by date when the patient has more than one active appointment', async () => {
    const { app, seed, env } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1], slotId: seed.slotIds[2] },
    });

    const ambiguous = await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1] },
    });
    expect(ambiguous.statusCode).toBe(422);

    const disambiguated = await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1], date: '2026-09-21' },
    });
    expect(disambiguated.statusCode).toBe(200);
    expect(disambiguated.json()).toMatchObject({ slotId: seed.slotIds[2], status: 'cancelled' });

    await app.close();
  });

  it('frees the cancelled slot back into availability', async () => {
    const { app, seed, env } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1] },
    });

    const availability = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });

    expect(availability.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seed.slotIds[1], startTime: '10:00' }),
      ]),
    );
    await app.close();
  });

  it('returns 404 when the given date matches no active appointment', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[1], date: '2026-09-21' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('APPOINTMENT_NOT_FOUND');
    await app.close();
  });

  it('returns 404 when the patient has no active appointment', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/cancel-by-patient',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0] },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
