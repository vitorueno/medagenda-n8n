import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /doctors', () => {
  it('lists all doctors', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/doctors',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ name: string; specialty: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((doctor) => doctor.specialty).sort()).toEqual(['cardiology', 'dermatology']);
    await app.close();
  });

  it('returns 401 without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/doctors' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
