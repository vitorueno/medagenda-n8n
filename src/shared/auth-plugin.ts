import { timingSafeEqual } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export interface AuthPluginOptions {
  apiKey: string;
  publicPaths?: string[];
}

const DEFAULT_PUBLIC_PATHS = ['/health', '/docs'];

function matchesPublicPath(url: string, publicPaths: string[]): boolean {
  const pathname = url.split('?')[0] ?? url;
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isSameKey(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers. Returning early on a length
  // mismatch leaks only the key's length, which is not the secret.
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function authPluginImpl(
  app: Parameters<FastifyPluginAsync<AuthPluginOptions>>[0],
  options: AuthPluginOptions,
) {
  const publicPaths = options.publicPaths ?? DEFAULT_PUBLIC_PATHS;

  app.addHook('onRequest', async (request, reply) => {
    if (matchesPublicPath(request.url, publicPaths)) {
      return;
    }

    if (!isSameKey(request.headers['x-api-key'], options.apiKey)) {
      return reply
        .status(401)
        .send({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' });
    }
  });
}

export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = fp(authPluginImpl);
