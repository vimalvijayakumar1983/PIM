import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const localeSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

const translationSchema = z.object({
  productId: z.string(),
  localeId: z.string(),
  title: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  shortDesc: z.string().optional(),
  longDesc: z.string().optional(),
  specs: z.any().optional(),
  faqs: z.any().optional(),
});

export async function localeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const locales = await prisma.locale.findMany({ orderBy: { name: 'asc' } });
    return reply.send({ success: true, data: locales });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = localeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const locale = await prisma.locale.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: locale });
  });

  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = localeSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const locale = await prisma.locale.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: locale });
  });

  // Product translations
  app.get('/translations/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const translations = await prisma.productTranslation.findMany({
      where: { productId },
      include: { locale: true },
    });
    return reply.send({ success: true, data: translations });
  });

  app.post('/translations', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const parsed = translationSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const translation = await prisma.productTranslation.upsert({
      where: { productId_localeId: { productId: parsed.data.productId, localeId: parsed.data.localeId } },
      update: parsed.data,
      create: parsed.data,
    });
    return reply.send({ success: true, data: translation });
  });
}
