import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';

const reportRoutes: FastifyPluginAsync = async (app) => {
  // Submit report generation job
  app.post('/api/reports', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.body as Record<string, unknown>;
    const job = await app.queue.add('report_generate', payload);
    return { taskId: job.id };
  });

  // Poll report job
  app.get('/api/reports/:taskId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const job = await app.queue.getJob(taskId);
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const state = await job.getState();
    if (state === 'completed') {
      const { reportId } = job.returnvalue as { reportId: string; pdfPath: string };
      return { state, downloadUrl: `/api/reports/download/${reportId}` };
    }
    if (state === 'failed') {
      return { state, failedReason: job.failedReason };
    }
    return { state };
  });

  // Download PDF
  app.get('/api/reports/download/:reportId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const reportDir = process.env.REPORT_DIR ?? path.resolve(process.cwd(), 'data', 'reports');
    const pdfPath = path.join(reportDir, `${reportId}.pdf`);
    return reply.sendFile(path.basename(pdfPath), reportDir);
  });
};

export default reportRoutes;
