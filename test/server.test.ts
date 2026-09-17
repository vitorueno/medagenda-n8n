import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app';

describe('buildApp', () => {
  it('exposes a public health check', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('serves swagger UI without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs' });
    expect(response.statusCode).toBeLessThan(400);
    await app.close();
  });
});
