import type { FastifyPluginAsync } from 'fastify';

const aiRoutes: FastifyPluginAsync = async (app) => {
  // Submit AI layout job
  app.post('/api/ai/layout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { prompt } = req.body as { prompt: string };
    if (!prompt?.trim()) return reply.code(400).send({ error: 'Missing prompt' });

    const job = await app.queue.add('ai_layout', { prompt });
    return { taskId: job.id };
  });

  // Poll AI layout job
  app.get('/api/ai/layout/:taskId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const job = await app.queue.getJob(taskId);
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const state = await job.getState();
    if (state === 'completed') {
      return { state, result: job.returnvalue };
    }
    if (state === 'failed') {
      return { state, failedReason: job.failedReason };
    }
    return { state };
  });
};

export default aiRoutes;
