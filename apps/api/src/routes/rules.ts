import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']),
    value: z.any(),
  })),
  actions: z.array(z.object({
    type: z.enum(['set_value', 'copy_value', 'set_category', 'set_family', 'set_status', 'add_tag']),
    field: z.string().optional(),
    value: z.any(),
    sourceField: z.string().optional(),
  })),
});

export async function ruleRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const rules = await prisma.enrichmentRule.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
    return reply.send({ success: true, data: rules });
  });

  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    const rule = await prisma.enrichmentRule.create({ data: parsed.data as any });
    return reply.status(201).send({ success: true, data: rule });
  });

  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const rule = await prisma.enrichmentRule.update({ where: { id }, data: parsed.data as any });
    return reply.send({ success: true, data: rule });
  });

  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.enrichmentRule.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Rule deleted' } });
  });

  // Execute rules on products
  app.post('/execute', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { productIds } = req.body as { productIds?: string[] };
    const rules = await prisma.enrichmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    let affected = 0;
    const products = productIds
      ? await prisma.product.findMany({ where: { id: { in: productIds } } })
      : await prisma.product.findMany({ where: { status: 'DRAFT' } });

    for (const product of products) {
      for (const rule of rules) {
        const conditions = rule.conditions as any[];
        const actions = rule.actions as any[];
        let match = true;

        for (const cond of conditions) {
          const val = (product as any)[cond.field];
          switch (cond.operator) {
            case 'equals': match = val === cond.value; break;
            case 'not_equals': match = val !== cond.value; break;
            case 'contains': match = typeof val === 'string' && val.includes(cond.value); break;
            case 'is_empty': match = !val; break;
            case 'is_not_empty': match = !!val; break;
            default: match = false;
          }
          if (!match) break;
        }

        if (match) {
          const updates: any = {};
          for (const action of actions) {
            if (action.type === 'set_value') updates[action.field] = action.value;
            if (action.type === 'copy_value') updates[action.field] = (product as any)[action.sourceField];
            if (action.type === 'set_status') updates.status = action.value;
          }
          if (Object.keys(updates).length > 0) {
            await prisma.product.update({ where: { id: product.id }, data: updates });
            affected++;
          }
        }
      }
      await prisma.enrichmentRule.updateMany({ data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    }

    return reply.send({ success: true, data: { affected, rulesApplied: rules.length } });
  });
}
