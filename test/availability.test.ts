import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /availability', () => {
  it('returns available slots for a date', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ status?: string }>;
    expect(body).toHaveLength(1);
    await app.close();
  });

  it('returns an empty array when there is no availability', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2099-01-01',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });

  it('filters by specialty', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-21&specialty=dermatology',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    await app.close();
  });

  it('rejects a malformed date', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=20-09-2026',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns the same result for repeated identical queries', async () => {
    const { app, env } = buildTestApp();
    const first = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    const second = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });

    expect(first.json()).toEqual(second.json());
    await app.close();
  });
});
