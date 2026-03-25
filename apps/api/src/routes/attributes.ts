import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const attributeTypeEnum = z.enum([
  'TEXT', 'TEXTAREA', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE',
  'SELECT', 'MULTI_SELECT', 'PRICE', 'METRIC', 'IMAGE', 'FILE',
  'COLOR', 'URL', 'IDENTIFIER',
]);

const attributeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: attributeTypeEnum,
  group: z.string().optional(),
  isRequired: z.boolean().default(false),
  isUnique: z.boolean().default(false),
  isLocalizable: z.boolean().default(false),
  isScopable: z.boolean().default(false),
  validationRule: z.string().optional(),
  validationMin: z.number().optional(),
  validationMax: z.number().optional(),
  allowedValues: z.any().optional(),
  defaultValue: z.string().optional(),
  unit: z.string().optional(),
  unitFamily: z.string().optional(),
  tooltip: z.string().optional(),
});

export async function attributeRoutes(app: FastifyInstance) {
  // List all attributes, filterable by group, type, and search
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { type, group, search } = req.query as { type?: string; group?: string; search?: string };
    const where: any = {};
    if (type) where.type = type;
    if (group) where.unitFamily = group; // unitFamily is used as group field
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const attributes = await prisma.attribute.findMany({
      where,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return reply.send({ success: true, data: attributes });
  });

  // List distinct attribute groups
  app.get('/groups', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const attributes = await prisma.attribute.findMany({
      where: { unitFamily: { not: null } },
      select: { unitFamily: true },
      distinct: ['unitFamily'],
      orderBy: { unitFamily: 'asc' },
    });
    const groups = attributes.map((a) => a.unitFamily).filter(Boolean);
    return reply.send({ success: true, data: groups });
  });

  // Get single attribute with usage info
  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attr = await prisma.attribute.findUnique({
      where: { id },
      include: {
        families: {
          include: {
            group: { select: { id: true, name: true, code: true } },
          },
        },
        _count: { select: { values: true, families: true } },
      },
    });
    if (!attr) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attribute not found' },
      });
    }
    return reply.send({ success: true, data: attr });
  });

  // Create attribute
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = attributeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }
    const existing = await prisma.attribute.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'An attribute with this code already exists' },
      });
    }
    const { group, ...data } = parsed.data;
    const attr = await prisma.attribute.create({
      data: { ...data, unitFamily: group || data.unitFamily },
    });
    return reply.status(201).send({ success: true, data: attr });
  });

  // Update attribute
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = attributeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }
    const { group, ...data } = parsed.data;
    const updateData: any = { ...data };
    if (group !== undefined) updateData.unitFamily = group;
    const attr = await prisma.attribute.update({ where: { id }, data: updateData });
    return reply.send({ success: true, data: attr });
  });

  // Delete attribute (only if not used)
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const usageCount = await prisma.productAttributeValue.count({ where: { attributeId: id } });
    if (usageCount > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'IN_USE',
          message: `Attribute is used by ${usageCount} product value(s). Remove them first.`,
        },
      });
    }

    const familyCount = await prisma.familyAttribute.count({ where: { attributeId: id } });
    if (familyCount > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'IN_USE',
          message: `Attribute is used in ${familyCount} family/families. Remove it from families first.`,
        },
      });
    }

    await prisma.attribute.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Attribute deleted' } });
  });

  // Set attribute value for a product
  app.post('/values', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { productId, attributeId, localeCode, channelCode, textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit } = req.body as any;
    const value = await prisma.productAttributeValue.upsert({
      where: {
        productId_attributeId_localeCode_channelCode: {
          productId,
          attributeId,
          localeCode: localeCode || null,
          channelCode: channelCode || null,
        },
      },
      update: { textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit },
      create: { productId, attributeId, localeCode, channelCode, textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit },
    });
    return reply.send({ success: true, data: value });
  });
}
