import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const channelSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  currencies: z.any().optional(),
  locales: z.any().optional(),
  categoryTree: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function channelRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const channels = await prisma.channel.findMany({ orderBy: { label: 'asc' } });
    return reply.send({ success: true, data: channels });
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } });
    return reply.send({ success: true, data: channel });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const channel = await prisma.channel.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: channel });
  });

  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = channelSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const channel = await prisma.channel.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: channel });
  });

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.channel.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Channel deleted' } });
  });
}
