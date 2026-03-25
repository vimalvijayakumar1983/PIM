import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const qualityRuleSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  field: z.string(),
  condition: z.string(),
  value: z.string().optional(),
  severity: z.string().default('warning'),
  message: z.string(),
  isActive: z.boolean().default(true),
});

export async function qualityRoutes(app: FastifyInstance) {
  // Calculate quality score for a product
  app.get('/score/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        family: { include: { attributes: { include: { attribute: true } } } },
        attributeValues: true,
      },
    });
    if (!product) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const issues: Array<{ field: string; severity: string; message: string; category: string }> = [];
    let score = 100;

    if (!product.title && !product.rawTitle) { issues.push({ field: 'title', severity: 'error', message: 'Product title is missing', category: 'content' }); score -= 15; }
    if (!product.longDesc && !product.rawDescription) { issues.push({ field: 'longDesc', severity: 'error', message: 'Description is missing', category: 'content' }); score -= 15; }
    if (!product.shortDesc) { issues.push({ field: 'shortDesc', severity: 'warning', message: 'Short description is missing', category: 'content' }); score -= 5; }
    if (!product.metaTitle) { issues.push({ field: 'metaTitle', severity: 'error', message: 'Meta title is missing', category: 'seo' }); score -= 10; }
    if (!product.metaDesc) { issues.push({ field: 'metaDesc', severity: 'error', message: 'Meta description is missing', category: 'seo' }); score -= 10; }
    if (product.images.length === 0) { issues.push({ field: 'images', severity: 'error', message: 'No product images', category: 'media' }); score -= 15; }
    if (!product.categoryId) { issues.push({ field: 'category', severity: 'warning', message: 'No category assigned', category: 'classification' }); score -= 5; }
    if (!product.brand) { issues.push({ field: 'brand', severity: 'warning', message: 'Brand is missing', category: 'content' }); score -= 3; }
    if (!product.sellingPrice) { issues.push({ field: 'sellingPrice', severity: 'warning', message: 'Price not set', category: 'pricing' }); score -= 5; }

    // Completeness based on family
    let completeness = 0;
    if (product.family) {
      const required = product.family.attributes.filter((a: any) => a.isRequired);
      const filled = required.filter((a: any) =>
        product.attributeValues.some((v: any) => v.attributeId === a.attributeId && (v.valueText || v.valueNumber !== null || v.valueBoolean !== null || v.valueJson))
      );
      completeness = required.length > 0 ? Math.round((filled.length / required.length) * 100) : 100;
    } else {
      const fields = ['title', 'longDesc', 'shortDesc', 'metaTitle', 'metaDesc'];
      const filled = fields.filter((f) => (product as any)[f]);
      completeness = Math.round((filled.length / fields.length) * 100);
    }

    score = Math.max(0, Math.min(100, score));
    await prisma.product.update({ where: { id: productId }, data: { qualityScore: score, completeness } });

    return reply.send({ success: true, data: { score, completeness, issues, totalIssues: issues.length } });
  });

  // Quality rules CRUD
  app.get('/rules', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const rules = await prisma.qualityRule.findMany({ orderBy: { name: 'asc' } });
    return reply.send({ success: true, data: rules });
  });

  app.post('/rules', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = qualityRuleSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const rule = await prisma.qualityRule.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: rule });
  });

  app.patch('/rules/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = qualityRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const rule = await prisma.qualityRule.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: rule });
  });

  // Overview stats
  app.get('/overview', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const products = await prisma.product.findMany({
      select: { id: true, qualityScore: true, completeness: true, title: true, rawTitle: true, longDesc: true, shortDesc: true, metaTitle: true, metaDesc: true, brand: true, categoryId: true, sellingPrice: true, _count: { select: { images: true } } },
    });

    const totalProducts = products.length;
    const avgScore = totalProducts > 0 ? Math.round(products.reduce((sum: number, p: any) => sum + p.qualityScore, 0) / totalProducts) : 0;
    const excellent = products.filter((p: any) => p.qualityScore >= 80).length;
    const good = products.filter((p: any) => p.qualityScore >= 50 && p.qualityScore < 80).length;
    const poor = products.filter((p: any) => p.qualityScore < 50).length;

    return reply.send({
      success: true,
      data: { totalProducts, avgScore, distribution: { excellent, good, poor } },
    });
  });
}
