import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return reply.code(400).send({ error: 'Missing fields' });

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

  app.get('/api/me', { onRequest: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string; email: string; role: string };
    const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error('User not found');
    return { id: user.id, email: user.email, role: user.role };
  });
};

export default authRoutes;
