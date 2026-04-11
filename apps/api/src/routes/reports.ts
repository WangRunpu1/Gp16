import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';

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
      const { reportId } = job.returnvalue as { reportId: string; htmlPath?: string; pdfPath?: string };
      return { state, downloadUrl: `/api/reports/download/${reportId}` };
    }
    if (state === 'failed') {
      return { state, failedReason: job.failedReason };
    }
    return { state };
  });

  // Download report (HTML, opens in browser for print-to-PDF)
  app.get('/api/reports/download/:reportId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const reportDir = process.env.REPORT_DIR ?? path.resolve(process.cwd(), 'data', 'reports');

    // Try HTML first (new format), then PDF (legacy)
    const htmlPath = path.join(reportDir, `${reportId}.html`);
    const pdfPath  = path.join(reportDir, `${reportId}.pdf`);

    try {
      await fs.access(htmlPath);
      const content = await fs.readFile(htmlPath, 'utf-8');
      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Content-Disposition', `inline; filename="report-${reportId}.html"`)
        .send(content);
    } catch {
      // Fallback to PDF if it exists
      try {
        await fs.access(pdfPath);
        return reply.sendFile(path.basename(pdfPath), reportDir);
      } catch {
        return reply.code(404).send({ error: 'Report not found' });
      }
    }
  });
};

export default reportRoutes;
