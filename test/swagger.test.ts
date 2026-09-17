import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app';

describe('swagger documentation', () => {
  it('exposes an OpenAPI document listing the known paths', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/patients/lookup',
        '/doctors',
        '/availability',
        '/appointments',
        '/appointments/{id}',
        '/appointments/{id}/cancel',
        '/payments',
      ]),
    );
    await app.close();
  });
});
