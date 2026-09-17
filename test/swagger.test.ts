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

  it('documents the x-api-key security requirement', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      components: { securitySchemes: Record<string, unknown> };
      security: Array<Record<string, unknown>>;
    };

    expect(document.components.securitySchemes.apiKey).toEqual({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    });
    expect(document.security).toEqual(expect.arrayContaining([{ apiKey: [] }]));
    await app.close();
  });
});
