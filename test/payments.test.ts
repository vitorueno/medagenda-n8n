import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /payments', () => {
  it('lists all payment configs when no filter is given', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/payments',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    await app.close();
  });

  it('filters by consultationType', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/payments?consultationType=consultation',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 1,
        consultationType: 'consultation',
        price: 250,
        paymentMethods: ['pix', 'credit_card', 'boleto'],
      },
    ]);
    await app.close();
  });

  it('returns 404 for an unknown consultationType', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/payments?consultationType=unknown',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
