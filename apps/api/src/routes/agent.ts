import type { FastifyPluginAsync } from 'fastify';
import type { AgentConversation, AgentMessage, AILayoutResult } from '@gp16/shared';
import { randomUUID } from 'crypto';
import { runAgentLoop } from '../agent/orchestrator.js';

// In-memory conversation store (production should use DB)
const conversations = new Map<string, AgentConversation>();

const agentRoutes: FastifyPluginAsync = async (app) => {
  // Create new conversation
  app.post('/api/agent/conversations', { onRequest: [app.authenticate] }, async (req) => {
    const body = req.body as { mode?: string } | undefined;
    const mode = (body?.mode as 'plan' | 'agent') ?? 'plan';
    const id = randomUUID();
    const conv: AgentConversation = {
      id,
      mode,
      messages: [],
      createdAt: Date.now(),
    };
    conversations.set(id, conv);
    return { id, mode };
  });

  // Get conversation
  app.get('/api/agent/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = conversations.get(id);
    if (!conv) return reply.code(404).send({ error: 'Not found' });
    return conv;
  });

  // Send message + get agent response
  app.post('/api/agent/:id/message', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = conversations.get(id);
    if (!conv) return reply.code(404).send({ error: 'Not found' });

    const body = req.body as { content: string; topology?: unknown };
    if (!body?.content?.trim()) return reply.code(400).send({ error: 'Missing content' });

    // Add user message
    const userMsg: AgentMessage = {
      id: randomUUID(),
      role: 'user',
      content: body.content,
      timestamp: Date.now(),
    };
    conv.messages.push(userMsg);

    // Run agent
    const { messages, layout } = await runAgentLoop(conv, body.content, body.topology as any);

    // Add assistant messages to conversation
    for (const msg of messages) {
      conv.messages.push(msg);
    }

    return { messages, layout };
  });

  // SSE stream for real-time updates
  app.get('/api/agent/:id/stream', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = conversations.get(id);
    if (!conv) return reply.code(404).send({ error: 'Not found' });

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    // Send current messages
    for (const msg of conv.messages) {
      reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
    }
    reply.raw.write(`data: [DONE]\n\n`);
    reply.raw.end();
  });

  // Delete conversation
  app.delete('/api/agent/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    conversations.delete(id);
    return { ok: true };
  });
};

export default agentRoutes;
