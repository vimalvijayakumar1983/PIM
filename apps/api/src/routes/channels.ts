import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const channelSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  websiteId: z.string().min(1),
  localeIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

const channelUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  websiteId: z.string().min(1).optional(),
  localeIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function channelRoutes(app: FastifyInstance) {
  // List all channels
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const channels = await prisma.channel.findMany({
      include: {
        website: { select: { id: true, name: true, domain: true } },
        locales: {
          include: { locale: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: channels });
  });

  // Create channel
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const existing = await prisma.channel.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'A channel with this code already exists' },
      });
    }

    const { localeIds, ...channelData } = parsed.data;

    const channel = await prisma.channel.create({
      data: {
        ...channelData,
        locales: localeIds && localeIds.length > 0
          ? {
            create: localeIds.map((localeId) => ({ localeId })),
          }
          : undefined,
      },
      include: {
        website: { select: { id: true, name: true, domain: true } },
        locales: { include: { locale: true } },
      },
    });

    return reply.status(201).send({ success: true, data: channel });
  });

  // Update channel
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = channelUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }

    const { localeIds, ...channelData } = parsed.data;

    // Update channel fields
    if (Object.keys(channelData).length > 0) {
      await prisma.channel.update({ where: { id }, data: channelData });
    }

    // Update locale associations if provided
    if (localeIds !== undefined) {
      // Remove existing locale associations
      await prisma.channelLocale.deleteMany({ where: { channelId: id } });
      // Add new ones
      if (localeIds.length > 0) {
        await prisma.channelLocale.createMany({
          data: localeIds.map((localeId) => ({ channelId: id, localeId })),
        });
      }
    }

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        website: { select: { id: true, name: true, domain: true } },
        locales: { include: { locale: true } },
      },
    });

    return reply.send({ success: true, data: channel });
  });

  // Delete channel
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };

    // Remove locale associations first
    await prisma.channelLocale.deleteMany({ where: { channelId: id } });
    await prisma.channel.delete({ where: { id } });

    return reply.send({ success: true, data: { message: 'Channel deleted' } });
  });
}
