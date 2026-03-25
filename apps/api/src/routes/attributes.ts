import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const attributeSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['TEXT', 'TEXTAREA', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT', 'PRICE', 'METRIC', 'IMAGE', 'FILE', 'COLOR', 'URL', 'IDENTIFIER']),
  group: z.string().default('general'),
  isRequired: z.boolean().default(false),
  isUnique: z.boolean().default(false),
  isLocalizable: z.boolean().default(false),
  isScopable: z.boolean().default(false),
  validationRule: z.string().optional(),
  validationRegex: z.string().optional(),
  maxLength: z.number().optional(),
  options: z.any().optional(),
  sortOrder: z.number().default(0),
  measurementFamily: z.string().optional(),
  defaultUnit: z.string().optional(),
});

export async function attributeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { type, search, group } = req.query as { type?: string; search?: string; group?: string };
    const where: any = {};
    if (type) where.type = type;
    if (group) where.group = group;
    if (search) where.label = { contains: search, mode: 'insensitive' };
    const attributes = await prisma.attribute.findMany({ where, orderBy: { sortOrder: 'asc' } });
    return reply.send({ success: true, data: attributes });
  });

  app.get('/groups', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const groups = await prisma.attribute.findMany({
      select: { group: true },
      distinct: ['group'],
      orderBy: { group: 'asc' },
    });
    return reply.send({ success: true, data: groups.map((g: { group: string }) => g.group) });
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attr = await prisma.attribute.findUnique({
      where: { id },
      include: { _count: { select: { values: true, familyAttributes: true } } },
    });
    if (!attr) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Attribute not found' } });
    return reply.send({ success: true, data: attr });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = attributeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    const existing = await prisma.attribute.findUnique({ where: { code: parsed.data.code } });
    if (existing) return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Attribute with this code already exists' } });
    const attr = await prisma.attribute.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: attr });
  });

  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = attributeSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const attr = await prisma.attribute.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: attr });
  });

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const usage = await prisma.productAttributeValue.count({ where: { attributeId: id } });
    if (usage > 0) return reply.status(400).send({ success: false, error: { code: 'IN_USE', message: `Attribute is used by ${usage} products` } });
    await prisma.attribute.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Attribute deleted' } });
  });

  // Set attribute value for a product
  app.post('/values', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId, attributeId, locale, channel, valueText, valueNumber, valueBoolean, valueDate, valueJson, unit } = req.body as any;
    const value = await prisma.productAttributeValue.upsert({
      where: { productId_attributeId_locale_channel: { productId, attributeId, locale: locale || null, channel: channel || null } },
      update: { valueText, valueNumber, valueBoolean, valueDate, valueJson, unit },
      create: { productId, attributeId, locale: locale || null, channel: channel || null, valueText, valueNumber, valueBoolean, valueDate, valueJson, unit },
    });
    return reply.send({ success: true, data: value });
  });
}
