import fp from 'fastify-plugin';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: IORedis;
    queue: Queue;
  }
}

export default fp(async (app) => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue('gp16-jobs', { connection: redis });

  app.decorate('redis', redis);
  app.decorate('queue', queue);
  app.addHook('onClose', async () => {
    await queue.close();
    redis.disconnect();
  });
});
