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

const addAttributeSchema = z.object({
  attributeId: z.string().min(1),
  isRequired: z.boolean().default(false),
  groupId: z.string().optional(),
});

export async function familyRoutes(app: FastifyInstance) {
  // List all families with attribute count
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const families = await prisma.productFamily.findMany({
      include: {
        attributeGroups: {
          include: {
            attributes: { include: { attribute: true } },
          },
          orderBy: { position: 'asc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    const data = families.map((f) => {
      const attributeCount = f.attributeGroups.reduce(
        (sum, g) => sum + g.attributes.length,
        0,
      );
      return { ...f, attributeCount };
    });

    return reply.send({ success: true, data });
  });

  // Get single family with its attributes
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
    if (!family) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Family not found' },
      });
    }
    return reply.send({ success: true, data: family });
  });

  // Create family
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = familySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }
    const existing = await prisma.productFamily.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'A family with this code already exists' },
      });
    }
    const family = await prisma.productFamily.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: family });
  });

  // Update family
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = familySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }
    const family = await prisma.productFamily.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: family });
  });

  // Delete family
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const productCount = await prisma.product.count({ where: { familyId: id } });
    if (productCount > 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'IN_USE', message: `Family is used by ${productCount} product(s). Remove them first.` },
      });
    }
    await prisma.productFamily.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Family deleted' } });
  });

  // Add attribute to family
  app.post('/:id/attributes', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addAttributeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const { attributeId, isRequired, groupId } = parsed.data;

    // Ensure a default group exists if no groupId provided
    let targetGroupId = groupId;
    if (!targetGroupId) {
      let defaultGroup = await prisma.attributeGroup.findFirst({
        where: { familyId: id, code: 'default' },
      });
      if (!defaultGroup) {
        defaultGroup = await prisma.attributeGroup.create({
          data: { name: 'Default', code: 'default', familyId: id, position: 0 },
        });
      }
      targetGroupId = defaultGroup.id;
    }

    const existing = await prisma.familyAttribute.findUnique({
      where: { familyId_attributeId: { familyId: id, attributeId } },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Attribute already belongs to this family' },
      });
    }

    const count = await prisma.familyAttribute.count({ where: { familyId: id } });
    const attr = await prisma.familyAttribute.create({
      data: {
        familyId: id,
        attributeId,
        groupId: targetGroupId,
        isRequired,
        position: count,
      },
      include: { attribute: true },
    });
    return reply.status(201).send({ success: true, data: attr });
  });

  // Remove attribute from family
  app.delete('/:id/attributes/:attributeId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id, attributeId } = req.params as { id: string; attributeId: string };
    const existing = await prisma.familyAttribute.findUnique({
      where: { familyId_attributeId: { familyId: id, attributeId } },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attribute not found in this family' },
      });
    }
    await prisma.familyAttribute.delete({
      where: { familyId_attributeId: { familyId: id, attributeId } },
    });
    return reply.send({ success: true, data: { message: 'Attribute removed from family' } });
  });

  // Add attribute group to family
  app.post('/:id/groups', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
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
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id, groupId } = req.params as { id: string; groupId: string };
    const { attributeId, isRequired } = req.body as { attributeId: string; isRequired?: boolean };
    const attr = await prisma.familyAttribute.create({
      data: { familyId: id, attributeId, groupId, isRequired: isRequired || false },
    });
    return reply.status(201).send({ success: true, data: attr });
  });
}
