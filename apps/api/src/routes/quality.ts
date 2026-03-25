import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

interface QualityIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  category: string;
}

// In-memory quality rules store (no DB model for QualityRule)
let qualityRules: Array<{
  id: string;
  name: string;
  field: string;
  check: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  penalty: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}> = [
  {
    id: 'default-title-missing',
    name: 'Title required',
    field: 'title',
    check: 'is_not_empty',
    severity: 'error',
    category: 'content',
    message: 'Product title is missing',
    penalty: 15,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-desc-missing',
    name: 'Description required',
    field: 'longDesc',
    check: 'is_not_empty',
    severity: 'error',
    category: 'content',
    message: 'Product description is missing',
    penalty: 15,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-meta-title',
    name: 'Meta title required',
    field: 'metaTitle',
    check: 'is_not_empty',
    severity: 'error',
    category: 'seo',
    message: 'Meta title is missing',
    penalty: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-meta-desc',
    name: 'Meta description required',
    field: 'metaDesc',
    check: 'is_not_empty',
    severity: 'error',
    category: 'seo',
    message: 'Meta description is missing',
    penalty: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const qualityRuleSchema = z.object({
  name: z.string().min(1),
  field: z.string().min(1),
  check: z.enum(['is_not_empty', 'min_length', 'max_length', 'has_images', 'has_category', 'has_price']),
  severity: z.enum(['error', 'warning', 'info']).default('warning'),
  category: z.string().default('content'),
  message: z.string().min(1),
  penalty: z.number().min(0).max(100).default(5),
  isActive: z.boolean().default(true),
});

function calculateScore(product: any, images: any[]): { score: number; completeness: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  // Title checks
  if (!product.title && !product.rawTitle) {
    issues.push({ field: 'title', severity: 'error', message: 'Product title is missing', category: 'content' });
    score -= 15;
  } else {
    const title = product.title || product.rawTitle || '';
    if (title.length < 20) {
      issues.push({ field: 'title', severity: 'warning', message: 'Title is too short (< 20 chars)', category: 'content' });
      score -= 5;
    }
    if (title.length > 100) {
      issues.push({ field: 'title', severity: 'warning', message: 'Title is too long (> 100 chars)', category: 'content' });
      score -= 3;
    }
    if (title === title.toUpperCase() && title.length > 3) {
      issues.push({ field: 'title', severity: 'info', message: 'Title is all uppercase', category: 'content' });
      score -= 2;
    }
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
  if (!product.metaTitle) {
    issues.push({ field: 'metaTitle', severity: 'error', message: 'Meta title is missing', category: 'seo' });
    score -= 10;
  }
  if (!product.metaDesc) {
    issues.push({ field: 'metaDesc', severity: 'error', message: 'Meta description is missing', category: 'seo' });
    score -= 10;
  }

  // Image checks
  if (images.length === 0) {
    issues.push({ field: 'images', severity: 'error', message: 'No product images', category: 'media' });
    score -= 15;
  } else {
    if (images.length < 3) {
      issues.push({ field: 'images', severity: 'warning', message: 'Less than 3 images', category: 'media' });
      score -= 5;
    }
    const missingAlt = images.filter((i: any) => !i.altText).length;
    if (missingAlt > 0) {
      issues.push({ field: 'images', severity: 'warning', message: `${missingAlt} image(s) missing alt text`, category: 'media' });
      score -= 3;
    }
  }

  // Category check
  if (!product.categoryId) {
    issues.push({ field: 'category', severity: 'warning', message: 'No category assigned', category: 'classification' });
    score -= 5;
  }

  // Brand check
  if (!product.brand) {
    issues.push({ field: 'brand', severity: 'warning', message: 'Brand is missing', category: 'content' });
    score -= 3;
  }

  // Pricing checks
  if (!product.sellingPrice) {
    issues.push({ field: 'sellingPrice', severity: 'warning', message: 'Selling price not set', category: 'pricing' });
    score -= 5;
  }
  if (product.marginPct && Number(product.marginPct) < 10) {
    issues.push({ field: 'marginPct', severity: 'warning', message: 'Margin below 10%', category: 'pricing' });
  }

  // Completeness
  const fields = ['title', 'longDesc', 'shortDesc', 'metaTitle', 'metaDesc'];
  const filled = fields.filter((f) => (product as any)[f]);
  const completeness = Math.round((filled.length / fields.length) * 100);

  score = Math.max(0, Math.min(100, score));

  return { score, completeness, issues };
}

export async function qualityRoutes(app: FastifyInstance) {
  // Calculate and return quality score for a product
  app.get('/score/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        family: {
          include: {
            attributeGroups: { include: { attributes: { include: { attribute: true } } } },
          },
        },
        attributeValues: true,
        translations: true,
      },
    });
    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const { score, issues } = calculateScore(product, product.images);

    // Family-based completeness
    let completeness = 0;
    if (product.family) {
      const requiredAttrs = product.family.attributeGroups
        .flatMap((g: any) => g.attributes)
        .filter((a: any) => a.isRequired);
      const filledAttrs = requiredAttrs.filter((a: any) =>
        product.attributeValues.some(
          (v: any) => v.attributeId === a.attributeId &&
            (v.textValue || v.numberValue !== null || v.booleanValue !== null || v.jsonValue),
        ),
      );
      completeness = requiredAttrs.length > 0
        ? Math.round((filledAttrs.length / requiredAttrs.length) * 100)
        : 100;
    } else {
      const fields = ['title', 'longDesc', 'shortDesc', 'metaTitle', 'metaDesc'];
      const filled = fields.filter((f) => (product as any)[f]);
      completeness = Math.round((filled.length / fields.length) * 100);
    }

    // Update product scores
    await prisma.product.update({
      where: { id: productId },
      data: { qualityScore: score, completeness },
    });

    const categories = {
      content: issues.filter((i) => i.category === 'content'),
      seo: issues.filter((i) => i.category === 'seo'),
      media: issues.filter((i) => i.category === 'media'),
      classification: issues.filter((i) => i.category === 'classification'),
      pricing: issues.filter((i) => i.category === 'pricing'),
    };

    return reply.send({
      success: true,
      data: { score, completeness, issues, categories, totalIssues: issues.length },
    });
  });

  // List quality rules
  app.get('/rules', { preHandler: [app.authenticate] }, async (_req, reply) => {
    return reply.send({ success: true, data: qualityRules });
  });

  // Create quality rule
  app.post('/rules', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = qualityRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }
    const now = new Date().toISOString();
    const rule = {
      id: `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };
    qualityRules.push(rule);
    return reply.status(201).send({ success: true, data: rule });
  });

  // Update quality rule
  app.patch('/rules/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const idx = qualityRules.findIndex((r) => r.id === id);
    if (idx === -1) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quality rule not found' },
      });
    }
    const parsed = qualityRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }
    qualityRules[idx] = {
      ...qualityRules[idx],
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    return reply.send({ success: true, data: qualityRules[idx] });
  });

  // Aggregate quality stats across all products
  app.get('/overview', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        rawTitle: true,
        longDesc: true,
        rawDescription: true,
        shortDesc: true,
        metaTitle: true,
        metaDesc: true,
        brand: true,
        categoryId: true,
        sellingPrice: true,
        qualityScore: true,
        completeness: true,
        status: true,
        _count: { select: { images: true } },
      },
    });

    const scores = products.map((p) => p.qualityScore || 0);
    const completenessValues = products.map((p) => p.completeness || 0);
    const total = products.length;

    const avgScore = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
    const avgCompleteness = total > 0
      ? Math.round(completenessValues.reduce((a, b) => a + b, 0) / total)
      : 0;

    const distribution = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 70 && s < 90).length,
      fair: scores.filter((s) => s >= 50 && s < 70).length,
      poor: scores.filter((s) => s < 50).length,
    };

    const missingTitle = products.filter((p) => !p.title && !p.rawTitle).length;
    const missingDescription = products.filter((p) => !p.longDesc && !p.rawDescription).length;
    const missingMetaTitle = products.filter((p) => !p.metaTitle).length;
    const missingMetaDesc = products.filter((p) => !p.metaDesc).length;
    const missingImages = products.filter((p) => p._count.images === 0).length;
    const missingCategory = products.filter((p) => !p.categoryId).length;

    return reply.send({
      success: true,
      data: {
        totalProducts: total,
        averageScore: avgScore,
        averageCompleteness: avgCompleteness,
        distribution,
        commonIssues: {
          missingTitle,
          missingDescription,
          missingMetaTitle,
          missingMetaDesc,
          missingImages,
          missingCategory,
        },
      },
    });
  });

  // Legacy: calculate quality for single product (backward compat)
  app.get('/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        family: {
          include: {
            attributeGroups: { include: { attributes: { include: { attribute: true } } } },
          },
        },
        attributeValues: true,
        translations: true,
      },
    });
    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const { score, completeness, issues } = calculateScore(product, product.images);

    await prisma.product.update({
      where: { id: productId },
      data: { qualityScore: score, completeness },
    });

    const categories = {
      content: issues.filter((i) => i.category === 'content'),
      seo: issues.filter((i) => i.category === 'seo'),
      media: issues.filter((i) => i.category === 'media'),
      classification: issues.filter((i) => i.category === 'classification'),
      pricing: issues.filter((i) => i.category === 'pricing'),
    };

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
      select: {
        id: true, title: true, rawTitle: true, longDesc: true,
        shortDesc: true, metaTitle: true, metaDesc: true, brand: true,
        categoryId: true, sellingPrice: true,
        _count: { select: { images: true } },
      },
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

    for (const r of results) {
      await prisma.product.update({ where: { id: r.id }, data: { qualityScore: r.score } });
    }

    return reply.send({ success: true, data: { updated: results.length, results } });
  });
}
