import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.string().optional(),
  promptTemplateId: z.string().optional(),
});

export async function categoryRoutes(app: FastifyInstance) {
  // List categories (tree)
  app.get('/', { preHandler: [app.authenticate] }, async (_request, reply) => {
    const categories = await prisma.category.findMany({
      include: {
        children: true,
        promptTemplate: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: categories });
  });

  // Get all flat
  app.get('/flat', { preHandler: [app.authenticate] }, async (_request, reply) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: categories });
  });

  // Create category
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const category = await prisma.category.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: category });
  });

  // Update category
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createCategorySchema.partial().safeParse(request.body);
    if (!data.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }

    const category = await prisma.category.update({ where: { id }, data: data.data });
    return reply.send({ success: true, data: category });
  });

  // Delete category
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.category.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Category deleted' } });
  });
}
