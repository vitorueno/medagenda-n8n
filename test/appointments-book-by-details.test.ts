import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments/by-details', () => {
  it('books by doctor name (accents/prefix-insensitive), date and time', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        doctorName: 'diego alves',
        date: '2026-09-21',
        startTime: '14:00',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      patientId: seed.patientIds[0],
      slotId: seed.slotIds[2],
      status: 'active',
    });
    await app.close();
  });

  it('books by specialty when no doctor name is given', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        specialty: 'dermatology',
        date: '2026-09-21',
        startTime: '14:00',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('returns 404 when the doctor does not match any doctor', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        doctorName: 'Dr. Ninguem',
        date: '2026-09-21',
        startTime: '14:00',
      },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 when the doctor has no slot at that exact date/time', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        doctorName: 'Diego Alves',
        date: '2026-09-21',
        startTime: '09:00',
      },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 for a date/time whose only matching slot is already booked', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: {
        patientId: seed.patientIds[0],
        doctorName: 'Carla Mendes',
        date: '2026-09-20',
        startTime: '10:00',
      },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 400 when neither doctorName nor specialty is given', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/by-details',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], date: '2026-09-21', startTime: '14:00' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
