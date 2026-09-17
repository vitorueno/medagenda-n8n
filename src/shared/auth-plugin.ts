import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export interface AuthPluginOptions {
  apiKey: string;
  publicPaths?: string[];
}

const DEFAULT_PUBLIC_PATHS = ['/health', '/docs'];

async function authPluginImpl(
  app: Parameters<FastifyPluginAsync<AuthPluginOptions>>[0],
  options: AuthPluginOptions,
) {
  const publicPaths = options.publicPaths ?? DEFAULT_PUBLIC_PATHS;

  app.addHook('onRequest', async (request, reply) => {
    const isPublic = publicPaths.some((path) => request.url.startsWith(path));
    if (isPublic) {
      return;
    }

    const providedKey = request.headers['x-api-key'];
    if (providedKey !== options.apiKey) {
      await reply
        .status(401)
        .send({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' });
    }
  });
}

export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = fp(authPluginImpl);
