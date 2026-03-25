import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const attributeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['TEXT', 'TEXTAREA', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT', 'PRICE', 'METRIC', 'IMAGE', 'FILE', 'URL', 'COLOR', 'IDENTIFIER']),
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
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { type, search } = req.query as { type?: string; search?: string };
    const where: any = {};
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const attributes = await prisma.attribute.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: attributes });
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attr = await prisma.attribute.findUnique({ where: { id } });
    if (!attr) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Attribute not found' } });
    return reply.send({ success: true, data: attr });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = attributeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
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
    await prisma.attribute.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Attribute deleted' } });
  });

  // Set attribute value for a product
  app.post('/values', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { productId, attributeId, localeCode, channelCode, textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit } = req.body as any;
    const value = await prisma.productAttributeValue.upsert({
      where: { productId_attributeId_localeCode_channelCode: { productId, attributeId, localeCode: localeCode || null, channelCode: channelCode || null } },
      update: { textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit },
      create: { productId, attributeId, localeCode, channelCode, textValue, numberValue, booleanValue, dateValue, jsonValue, mediaUrl, unit },
    });
    return reply.send({ success: true, data: value });
  });
}
