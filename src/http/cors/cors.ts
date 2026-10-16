import type { FastifyInstance } from 'fastify';

export function registerCors(application: FastifyInstance): void {
  application.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
  });
}
