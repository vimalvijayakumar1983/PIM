import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const familySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  imageAttribute: z.string().optional(),
  labelAttribute: z.string().optional(),
});

export async function familyRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const families = await prisma.productFamily.findMany({
      include: {
        attributeGroups: {
          include: { attributes: { include: { attribute: true } } },
          orderBy: { position: 'asc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: families });
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const family = await prisma.productFamily.findUnique({
      where: { id },
      include: {
        attributeGroups: {
          include: { attributes: { include: { attribute: true } } },
          orderBy: { position: 'asc' },
        },
        completenessRules: true,
        _count: { select: { products: true } },
      },
    });
    if (!family) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Family not found' } });
    return reply.send({ success: true, data: family });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = familySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    const family = await prisma.productFamily.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: family });
  });

  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = familySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const family = await prisma.productFamily.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: family });
  });

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.productFamily.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Family deleted' } });
  });

  // Add attribute group to family
  app.post('/:id/groups', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name, code } = req.body as { name: string; code: string };
    const count = await prisma.attributeGroup.count({ where: { familyId: id } });
    const group = await prisma.attributeGroup.create({
      data: { name, code, familyId: id, position: count },
    });
    return reply.status(201).send({ success: true, data: group });
  });

  // Add attribute to group
  app.post('/:id/groups/:groupId/attributes', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id, groupId } = req.params as { id: string; groupId: string };
    const { attributeId, isRequired } = req.body as { attributeId: string; isRequired?: boolean };
    const attr = await prisma.familyAttribute.create({
      data: { familyId: id, attributeId, groupId, isRequired: isRequired || false },
    });
    return reply.status(201).send({ success: true, data: attr });
  });
}
