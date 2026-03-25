import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const localeSchema = z.object({
  code: z.string().min(2), // e.g. "en_US"
  name: z.string().min(1), // e.g. "English (US)"
  isActive: z.boolean().default(true),
});

const localeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const localizedContentSchema = z.object({
  localeId: z.string().min(1),
  title: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  shortDesc: z.string().optional(),
  longDesc: z.string().optional(),
  specs: z.any().optional(),
  faqs: z.any().optional(),
});

export async function localeRoutes(app: FastifyInstance) {
  // List all locales
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const locales = await prisma.locale.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { productTranslations: true, channels: true } },
      },
    });
    return reply.send({ success: true, data: locales });
  });

  // Create locale
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = localeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }
    const existing = await prisma.locale.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'A locale with this code already exists' },
      });
    }
    const locale = await prisma.locale.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: locale });
  });

  // Update locale (toggle isActive, isDefault, etc.)
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = localeUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }
    const locale = await prisma.locale.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: locale });
  });

  // Delete locale
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const translationCount = await prisma.productTranslation.count({ where: { localeId: id } });
    if (translationCount > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'IN_USE',
          message: `Locale has ${translationCount} translation(s). Remove them first.`,
        },
      });
    }
    await prisma.locale.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Locale deleted' } });
  });

  // Get all localized content for a product
  app.get('/content/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const translations = await prisma.productTranslation.findMany({
      where: { productId },
      include: { locale: true },
      orderBy: { locale: { name: 'asc' } },
    });
    return reply.send({ success: true, data: translations });
  });

  // Create/update localized content for product+locale
  app.post('/content/:productId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const parsed = localizedContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const { localeId, ...contentData } = parsed.data;

    const translation = await prisma.productTranslation.upsert({
      where: {
        productId_localeId: { productId, localeId },
      },
      update: contentData,
      create: { productId, localeId, ...contentData },
      include: { locale: true },
    });
    return reply.send({ success: true, data: translation });
  });
}
