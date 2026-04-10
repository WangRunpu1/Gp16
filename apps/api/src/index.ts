import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import staticFiles from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import prismaPlugin from './plugins/prisma.js';
import queuePlugin from './plugins/queue.js';
import authRoutes from './routes/auth.js';
import analysisRoutes from './routes/analysis.js';
import aiRoutes from './routes/ai.js';
import reportRoutes from './routes/reports.js';
import topologyRoutes from './routes/topologies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'gp16-dev-secret-change-in-prod' });

// Decorate authenticate helper
app.decorate('authenticate', async function (req: any, reply: any) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

await app.register(prismaPlugin);
await app.register(queuePlugin);

// Serve frontend static files
// __dirname = apps/api/dist, web dist is at apps/web/dist
const webDist = path.resolve(__dirname, '../../../web/dist');
await app.register(staticFiles, { root: webDist, prefix: '/' });

// API routes
await app.register(authRoutes);
await app.register(analysisRoutes);
await app.register(aiRoutes);
await app.register(reportRoutes);
await app.register(topologyRoutes);

// Health check
app.get('/healthz', async () => ({ ok: true }));

// SPA fallback — serve index.html for non-API routes
app.setNotFoundHandler(async (req, reply) => {
  if (!req.url.startsWith('/api')) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ error: 'Not found' });
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: '0.0.0.0' });
console.log(`[api] listening on :${port}`);
