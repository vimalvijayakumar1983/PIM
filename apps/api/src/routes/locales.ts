import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const localeSchema = z.object({
  code: z.string().min(2),
  label: z.string().min(1),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export async function localeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const locales = await prisma.locale.findMany({ orderBy: { label: 'asc' } });
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

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.locale.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Locale deleted' } });
  });

  // Get localized content for a product
  app.get('/content/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const content = await prisma.localizedContent.findMany({
      where: { productId },
      include: { locale: true },
      orderBy: { locale: { label: 'asc' } },
    });
    return reply.send({ success: true, data: content });
  });

  // Create/update localized content
  app.post('/content/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const { localeId, title, metaTitle, metaDesc, shortDesc, longDesc, specs, faqs } = req.body as any;
    const content = await prisma.localizedContent.upsert({
      where: { productId_localeId: { productId, localeId } },
      update: { title, metaTitle, metaDesc, shortDesc, longDesc, specs, faqs },
      create: { productId, localeId, title, metaTitle, metaDesc, shortDesc, longDesc, specs, faqs },
    });
    return reply.send({ success: true, data: content });
  });
}
