import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { productFilterSchema, createProductSchema, updateProductSchema } from '@pim/types';
import { logProductFieldChanges, createAuditLog } from '../lib/audit';
import { validateSEO } from '../lib/seo-validator';

export async function productRoutes(app: FastifyInstance) {
  // List products with filters + pagination
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = productFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid filters', details: parsed.error.flatten() },
      });
    }

    const { status, categoryId, brand, websiteId, priority, search, page, pageSize, sortBy, sortOrder } = parsed.data;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (websiteId) where.websiteId = websiteId;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { rawTitle: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.updatedAt = 'desc';
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          website: { select: { id: true, name: true, domain: true } },
          images: { where: { isPrimary: true }, take: 1 },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  });

  // Get single product
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        website: true,
        images: { orderBy: { position: 'asc' } },
        tasks: { include: { assignedTo: { select: { id: true, name: true, email: true } } } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const seoValidation = validateSEO(product);
    return reply.send({ success: true, data: { ...product, seoValidation } });
  });

  // Create product
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'CATALOGER')],
  }, async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_SKU', message: 'Product with this SKU already exists' },
      });
    }

    const product = await prisma.product.create({ data: parsed.data });

    await createAuditLog({
      userId: request.user!.userId,
      productId: product.id,
      action: 'CREATE',
    });

    return reply.status(201).send({ success: true, data: product });
  });

  // Update product
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'CATALOGER', 'REVIEWER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    // Check pricing role gate
    const pricingFields = ['costPrice', 'sellingPrice'];
    const hasPricingChanges = pricingFields.some((f) => (parsed.data as any)[f] !== undefined);
    if (hasPricingChanges && !['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(request.user!.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only FINANCE, ADMIN, or SUPER_ADMIN can modify pricing' },
      });
    }

    // Auto-calculate margin
    const data: any = { ...parsed.data };
    const cost = data.costPrice ?? Number(existing.costPrice);
    const sell = data.sellingPrice ?? Number(existing.sellingPrice);
    if (cost && sell && sell > 0) {
      data.marginPct = ((sell - cost) / sell) * 100;
    }

    const product = await prisma.product.update({ where: { id }, data });

    await logProductFieldChanges(
      request.user!.userId,
      id,
      existing as unknown as Record<string, unknown>,
      data,
    );

    return reply.send({ success: true, data: product });
  });

  // Delete product
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.auditLog.deleteMany({ where: { productId: id } });
    await prisma.task.deleteMany({ where: { productId: id } });
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.productEmbedding.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    return reply.send({ success: true, data: { message: 'Product deleted' } });
  });

  // Bulk import via CSV/Excel
  app.post('/import', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    const buffer = await data.toBuffer();
    const fileName = data.filename.toLowerCase();
    let rows: any[] = [];

    if (fileName.endsWith('.csv')) {
      const { parse } = await import('csv-parse/sync');
      rows = parse(buffer.toString(), { columns: true, skip_empty_lines: true });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FORMAT', message: 'Only CSV and Excel files are supported' },
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const sku = row.sku || row.SKU;
        if (!sku) {
          skipped++;
          continue;
        }

        const websiteId = row.websiteId || row.website_id;
        if (!websiteId) {
          errors.push(`Row with SKU ${sku}: missing websiteId`);
          skipped++;
          continue;
        }

        await prisma.product.upsert({
          where: { sku },
          update: {
            rawTitle: row.title || row.rawTitle || row.raw_title,
            rawDescription: row.description || row.rawDescription || row.raw_description,
            brand: row.brand,
          },
          create: {
            sku,
            websiteId,
            rawTitle: row.title || row.rawTitle || row.raw_title,
            rawDescription: row.description || row.rawDescription || row.raw_description,
            brand: row.brand,
            categoryId: row.categoryId || row.category_id || undefined,
            priority: row.priority || 'MEDIUM',
          },
        });
        imported++;
      } catch (err: any) {
        errors.push(`Row SKU ${row.sku}: ${err.message}`);
        skipped++;
      }
    }

    await createAuditLog({
      userId: request.user!.userId,
      action: 'BULK_IMPORT',
      newValue: JSON.stringify({ imported, skipped, totalRows: rows.length }),
    });

    return reply.send({
      success: true,
      data: { imported, skipped, totalRows: rows.length, errors: errors.slice(0, 20) },
    });
  });

  // Approve product content
  app.post('/:id/approve', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    if (product.status !== 'AI_GENERATED' && product.status !== 'IN_REVIEW') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Product must be in AI_GENERATED or IN_REVIEW status' },
      });
    }

    // Copy AI fields to approved fields
    const updated = await prisma.product.update({
      where: { id },
      data: {
        title: product.aiTitle,
        metaTitle: product.aiMetaTitle,
        metaDesc: product.aiMetaDesc,
        shortDesc: product.aiShortDesc,
        longDesc: product.aiLongDesc,
        specs: product.aiSpecs ?? undefined,
        faqs: product.aiFaqs ?? undefined,
        schemaMarkup: product.aiSchemaMarkup ?? undefined,
        status: 'APPROVED',
      },
    });

    await createAuditLog({
      userId: request.user!.userId,
      productId: id,
      action: 'APPROVE',
      field: 'status',
      oldValue: product.status,
      newValue: 'APPROVED',
    });

    return reply.send({ success: true, data: updated });
  });

  // Reject product content
  app.post('/:id/reject', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { status: 'DRAFT' },
    });

    // Create task for re-enrichment
    await prisma.task.create({
      data: {
        productId: id,
        type: 'ENRICH_CONTENT',
        status: 'PENDING',
        notes: notes || 'Content rejected by reviewer',
      },
    });

    await createAuditLog({
      userId: request.user!.userId,
      productId: id,
      action: 'REJECT',
      field: 'status',
      oldValue: product.status,
      newValue: 'DRAFT',
    });

    return reply.send({ success: true, data: updated });
  });

  // Get SEO validation for a product
  app.get('/:id/seo', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const result = validateSEO(product);
    return reply.send({ success: true, data: result });
  });
}
