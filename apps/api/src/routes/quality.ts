import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';

export async function qualityRoutes(app: FastifyInstance) {
  // Calculate quality score for a product
  app.get('/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        family: { include: { attributeGroups: { include: { attributes: { include: { attribute: true } } } } } },
        attributeValues: true,
        translations: true,
      },
    });
    if (!product) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const issues: Array<{ field: string; severity: 'error' | 'warning' | 'info'; message: string; category: string }> = [];
    let score = 100;

    // Title checks
    if (!product.title && !product.rawTitle) {
      issues.push({ field: 'title', severity: 'error', message: 'Product title is missing', category: 'content' });
      score -= 15;
    } else {
      const title = product.title || product.rawTitle || '';
      if (title.length < 20) { issues.push({ field: 'title', severity: 'warning', message: 'Title is too short (< 20 chars)', category: 'content' }); score -= 5; }
      if (title.length > 100) { issues.push({ field: 'title', severity: 'warning', message: 'Title is too long (> 100 chars)', category: 'content' }); score -= 3; }
      if (title === title.toUpperCase()) { issues.push({ field: 'title', severity: 'info', message: 'Title is all uppercase', category: 'content' }); score -= 2; }
    }

    // Description checks
    if (!product.longDesc && !product.rawDescription) {
      issues.push({ field: 'longDesc', severity: 'error', message: 'Product description is missing', category: 'content' });
      score -= 15;
    }
    if (!product.shortDesc) {
      issues.push({ field: 'shortDesc', severity: 'warning', message: 'Short description is missing', category: 'content' });
      score -= 5;
    }

    // SEO checks
    if (!product.metaTitle) { issues.push({ field: 'metaTitle', severity: 'error', message: 'Meta title is missing', category: 'seo' }); score -= 10; }
    if (!product.metaDesc) { issues.push({ field: 'metaDesc', severity: 'error', message: 'Meta description is missing', category: 'seo' }); score -= 10; }

    // Image checks
    if (product.images.length === 0) {
      issues.push({ field: 'images', severity: 'error', message: 'No product images', category: 'media' });
      score -= 15;
    } else {
      if (product.images.length < 3) { issues.push({ field: 'images', severity: 'warning', message: 'Less than 3 images', category: 'media' }); score -= 5; }
      const missingAlt = product.images.filter((i: any) => !i.altText).length;
      if (missingAlt > 0) { issues.push({ field: 'images', severity: 'warning', message: `${missingAlt} image(s) missing alt text`, category: 'media' }); score -= 3; }
    }

    // Category check
    if (!product.categoryId) { issues.push({ field: 'category', severity: 'warning', message: 'No category assigned', category: 'classification' }); score -= 5; }

    // Brand check
    if (!product.brand) { issues.push({ field: 'brand', severity: 'warning', message: 'Brand is missing', category: 'content' }); score -= 3; }

    // Pricing checks
    if (!product.sellingPrice) { issues.push({ field: 'sellingPrice', severity: 'warning', message: 'Selling price not set', category: 'pricing' }); score -= 5; }
    if (product.marginPct && Number(product.marginPct) < 10) {
      issues.push({ field: 'marginPct', severity: 'warning', message: 'Margin below 10%', category: 'pricing' });
    }

    // Completeness based on family
    let completeness = 0;
    if (product.family) {
      const requiredAttrs = product.family.attributeGroups
        .flatMap((g: any) => g.attributes)
        .filter((a: any) => a.isRequired);
      const filled = requiredAttrs.filter((a: any) =>
        product.attributeValues.some((v: any) => v.attributeId === a.attributeId && (v.textValue || v.numberValue !== null || v.booleanValue !== null || v.jsonValue))
      );
      completeness = requiredAttrs.length > 0 ? Math.round((filled.length / requiredAttrs.length) * 100) : 100;
    } else {
      const fields = ['title', 'longDesc', 'shortDesc', 'metaTitle', 'metaDesc'];
      const filled = fields.filter((f) => (product as any)[f]);
      completeness = Math.round((filled.length / fields.length) * 100);
    }

    score = Math.max(0, Math.min(100, score));
    const categories = {
      content: issues.filter((i) => i.category === 'content'),
      seo: issues.filter((i) => i.category === 'seo'),
      media: issues.filter((i) => i.category === 'media'),
      classification: issues.filter((i) => i.category === 'classification'),
      pricing: issues.filter((i) => i.category === 'pricing'),
    };

    // Update product scores
    await prisma.product.update({
      where: { id: productId },
      data: { qualityScore: score, completeness },
    });

    return reply.send({
      success: true,
      data: { score, completeness, issues, categories, totalIssues: issues.length },
    });
  });

  // Bulk quality check
  app.post('/bulk', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productIds } = req.body as { productIds?: string[] };
    const where = productIds ? { id: { in: productIds } } : {};
    const products = await prisma.product.findMany({
      where,
      select: { id: true, title: true, rawTitle: true, longDesc: true, shortDesc: true, metaTitle: true, metaDesc: true, brand: true, categoryId: true, sellingPrice: true, _count: { select: { images: true } } },
    });

    const results = products.map((p: any) => {
      let score = 100;
      if (!p.title && !p.rawTitle) score -= 15;
      if (!p.longDesc) score -= 15;
      if (!p.shortDesc) score -= 5;
      if (!p.metaTitle) score -= 10;
      if (!p.metaDesc) score -= 10;
      if (p._count.images === 0) score -= 15;
      if (!p.categoryId) score -= 5;
      if (!p.brand) score -= 3;
      if (!p.sellingPrice) score -= 5;
      return { id: p.id, score: Math.max(0, score) };
    });

    // Batch update
    for (const r of results) {
      await prisma.product.update({ where: { id: r.id }, data: { qualityScore: r.score } });
    }

    return reply.send({ success: true, data: { updated: results.length, results } });
  });
}
