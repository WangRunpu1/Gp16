import type { FastifyPluginAsync } from 'fastify';
import { analyze } from '../services/analysis.js';
import type { Topology, AnalysisConfig } from '@gp16/shared';

const analysisRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/analysis', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { topology, config } = req.body as { topology: Topology; config?: AnalysisConfig };
    if (!topology) return reply.code(400).send({ error: 'Missing topology' });
    return analyze(topology, config);
  });
};

export default analysisRoutes;
