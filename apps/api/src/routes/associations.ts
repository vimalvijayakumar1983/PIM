import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const associationTypeEnum = z.enum([
  'CROSS_SELL', 'UPSELL', 'SUBSTITUTE', 'PACK', 'ACCESSORY',
]);

const associationSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: associationTypeEnum,
  sortOrder: z.number().default(0),
});

const bulkAssociationSchema = z.object({
  associations: z.array(associationSchema).min(1),
});

export async function associationRoutes(app: FastifyInstance) {
  // Get all associations for a product (grouped by type)
  app.get('/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const associations = await prisma.productAssociation.findMany({
      where: { fromId: productId },
      include: {
        to: {
          select: { id: true, sku: true, title: true, rawTitle: true, status: true },
        },
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });

    // Group by type
    const grouped: Record<string, typeof associations> = {};
    for (const assoc of associations) {
      if (!grouped[assoc.type]) grouped[assoc.type] = [];
      grouped[assoc.type].push(assoc);
    }

    return reply.send({ success: true, data: { associations, grouped } });
  });

  // Create association
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = associationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    if (parsed.data.fromId === parsed.data.toId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot associate a product with itself' },
      });
    }

    const existing = await prisma.productAssociation.findUnique({
      where: {
        fromId_toId_type: {
          fromId: parsed.data.fromId,
          toId: parsed.data.toId,
          type: parsed.data.type,
        },
      },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'This association already exists' },
      });
    }

    const assoc = await prisma.productAssociation.create({
      data: parsed.data,
      include: {
        to: {
          select: { id: true, sku: true, title: true, rawTitle: true, status: true },
        },
      },
    });
    return reply.status(201).send({ success: true, data: assoc });
  });

  // Delete association
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.productAssociation.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Association deleted' } });
  });

  // Bulk create associations
  app.post('/bulk', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = bulkAssociationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }

    const results: { created: number; skipped: number; errors: string[] } = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const assocData of parsed.data.associations) {
      try {
        if (assocData.fromId === assocData.toId) {
          results.skipped++;
          results.errors.push(`Skipped self-association for product ${assocData.fromId}`);
          continue;
        }

        await prisma.productAssociation.create({ data: assocData });
        results.created++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          results.skipped++;
        } else {
          results.errors.push(err.message);
        }
      }
    }

    return reply.status(201).send({ success: true, data: results });
  });
}
