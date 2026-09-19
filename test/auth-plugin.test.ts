import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { authPlugin } from '../src/shared/auth-plugin';

function buildTestServer() {
  const app = Fastify();
  void app.register(authPlugin, { apiKey: 'expected-key' });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/healthcheck-internal', async () => ({ secret: true }));
  app.get('/protected', async () => ({ secret: true }));
  return app;
}

describe('authPlugin', () => {
  it('allows public paths without a key', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });

  it('does not treat a route that merely shares a public path prefix as public', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/healthcheck-internal' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a key that is a prefix of the expected one', async () => {
    const app = buildTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'expected' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects protected paths without a key', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects protected paths with a wrong key', async () => {
    const app = buildTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows protected paths with the correct key', async () => {
    const app = buildTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'expected-key' },
    });
    expect(response.statusCode).toBe(200);
  });
});
