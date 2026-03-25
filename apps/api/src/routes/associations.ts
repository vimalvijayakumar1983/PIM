import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const associationSchema = z.object({
  sourceProductId: z.string(),
  targetProductId: z.string(),
  type: z.enum(['CROSS_SELL', 'UP_SELL', 'SUBSTITUTION', 'PACK', 'ACCESSORY', 'SIMILAR']),
  position: z.number().default(0),
});

export async function associationRoutes(app: FastifyInstance) {
  app.get('/:productId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const associations = await prisma.productAssociation.findMany({
      where: { sourceProductId: productId },
      include: { targetProduct: { select: { id: true, sku: true, title: true, rawTitle: true, status: true } } },
      orderBy: [{ type: 'asc' }, { position: 'asc' }],
    });
    return reply.send({ success: true, data: associations });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = associationSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const assoc = await prisma.productAssociation.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: assoc });
  });

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.productAssociation.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Association deleted' } });
  });
}
