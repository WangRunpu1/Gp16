import type { FastifyPluginAsync } from 'fastify';
import type { TopologyNode, TopologyEdge } from '@gp16/shared';

const topologyRoutes: FastifyPluginAsync = async (app) => {
  // List user's saved topologies
  app.get('/api/topologies', { onRequest: [app.authenticate] }, async (req) => {
    const { sub } = req.user as { sub: string };
    const rows = await app.prisma.topology.findMany({
      where: { userId: sub },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      nodes: JSON.parse(r.nodesJson) as TopologyNode[],
      edges: JSON.parse(r.edgesJson) as TopologyEdge[],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

  // Save topology
  app.post('/api/topologies', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { name, nodes, edges } = req.body as {
      name: string;
      nodes: TopologyNode[];
      edges: TopologyEdge[];
    };
    if (!name) return reply.code(400).send({ error: 'Missing name' });

    const row = await app.prisma.topology.create({
      data: {
        name,
        userId: sub,
        nodesJson: JSON.stringify(nodes ?? []),
        edgesJson: JSON.stringify(edges ?? []),
      },
    });
    return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() };
  });

  // Delete topology
  app.delete('/api/topologies/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const row = await app.prisma.topology.findUnique({ where: { id } });
    if (!row || row.userId !== sub) return reply.code(404).send({ error: 'Not found' });
    await app.prisma.topology.delete({ where: { id } });
    return { ok: true };
  });
};

export default topologyRoutes;
