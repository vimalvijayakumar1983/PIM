import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';
import { hash } from 'bcryptjs';

const createWebsiteSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  platform: z.string().min(1),
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'CATALOGER', 'REVIEWER', 'FINANCE', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  // --- Website Management ---
  app.get('/websites', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (_request, reply) => {
    const websites = await prisma.website.findMany({ orderBy: { name: 'asc' } });
    // Mask API tokens
    const masked = websites.map((w: { apiToken: string; [key: string]: unknown }) => ({ ...w, apiToken: '****' + w.apiToken.slice(-4) }));
    return reply.send({ success: true, data: masked });
  });

  app.post('/websites', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const parsed = createWebsiteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const website = await prisma.website.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: website });
  });

  app.patch('/websites/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createWebsiteSchema.partial().safeParse(request.body);
    if (!data.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const website = await prisma.website.update({ where: { id }, data: data.data });
    return reply.send({ success: true, data: website });
  });

  // --- User Management ---
  app.get('/users', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: users });
  });

  app.patch('/users/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data as any,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    return reply.send({ success: true, data: user });
  });

  // Reset user password (admin only)
  app.post('/users/:id/reset-password', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { password } = request.body as { password: string };
    if (!password || password.length < 8) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
    }
    const passwordHash = await hash(password, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    return reply.send({ success: true, data: { message: 'Password reset successful' } });
  });
}
