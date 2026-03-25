import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals', 'not_equals', 'contains', 'not_contains',
    'starts_with', 'ends_with', 'greater_than', 'less_than',
    'is_empty', 'is_not_empty',
  ]),
  value: z.any(),
});

const actionSchema = z.object({
  type: z.enum(['set_value', 'copy_value', 'set_category', 'set_family', 'set_status', 'add_tag']),
  field: z.string().optional(),
  value: z.any(),
  sourceField: z.string().optional(),
});

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
  conditions: z.array(conditionSchema),
  actions: z.array(actionSchema),
});

function matchesCondition(product: any, condition: { field: string; operator: string; value: any }): boolean {
  const val = product[condition.field];
  switch (condition.operator) {
    case 'equals': return val === condition.value;
    case 'not_equals': return val !== condition.value;
    case 'contains': return typeof val === 'string' && val.toLowerCase().includes(String(condition.value).toLowerCase());
    case 'not_contains': return typeof val === 'string' && !val.toLowerCase().includes(String(condition.value).toLowerCase());
    case 'starts_with': return typeof val === 'string' && val.toLowerCase().startsWith(String(condition.value).toLowerCase());
    case 'ends_with': return typeof val === 'string' && val.toLowerCase().endsWith(String(condition.value).toLowerCase());
    case 'greater_than': return typeof val === 'number' && val > Number(condition.value);
    case 'less_than': return typeof val === 'number' && val < Number(condition.value);
    case 'is_empty': return !val || (typeof val === 'string' && val.trim() === '');
    case 'is_not_empty': return !!val && (typeof val !== 'string' || val.trim() !== '');
    default: return false;
  }
}

function buildUpdatesFromActions(product: any, actions: any[]): Record<string, any> {
  const updates: Record<string, any> = {};
  for (const action of actions) {
    switch (action.type) {
      case 'set_value':
        if (action.field) updates[action.field] = action.value;
        break;
      case 'copy_value':
        if (action.field && action.sourceField) updates[action.field] = product[action.sourceField];
        break;
      case 'set_status':
        updates.status = action.value;
        break;
      case 'set_category':
        updates.categoryId = action.value;
        break;
      case 'set_family':
        updates.familyId = action.value;
        break;
    }
  }
  return updates;
}

export async function ruleRoutes(app: FastifyInstance) {
  // List all rules
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const rules = await prisma.enrichmentRule.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
    return reply.send({ success: true, data: rules });
  });

  // Get rule with conditions and actions
  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rule = await prisma.enrichmentRule.findUnique({ where: { id } });
    if (!rule) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Rule not found' },
      });
    }
    return reply.send({ success: true, data: rule });
  });

  // Create rule
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      });
    }
    const rule = await prisma.enrichmentRule.create({ data: parsed.data as any });
    return reply.status(201).send({ success: true, data: rule });
  });

  // Update rule
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
    }
    const rule = await prisma.enrichmentRule.update({ where: { id }, data: parsed.data as any });
    return reply.send({ success: true, data: rule });
  });

  // Delete rule
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.enrichmentRule.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Rule deleted' } });
  });

  // Execute a specific rule against matching products
  app.post('/:id/run', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rule = await prisma.enrichmentRule.findUnique({ where: { id } });
    if (!rule) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Rule not found' },
      });
    }

    const conditions = rule.conditions as any[];
    const actions = rule.actions as any[];
    const products = await prisma.product.findMany();

    let affected = 0;
    for (const product of products) {
      const allMatch = conditions.every((cond) => matchesCondition(product, cond));
      if (!allMatch) continue;

      const updates = buildUpdatesFromActions(product, actions);
      if (Object.keys(updates).length > 0) {
        await prisma.product.update({ where: { id: product.id }, data: updates });
        affected++;
      }
    }

    await prisma.enrichmentRule.update({
      where: { id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    return reply.send({
      success: true,
      data: {
        ruleId: id,
        ruleName: rule.name,
        productsEvaluated: products.length,
        productsAffected: affected,
      },
    });
  });

  // Execute all active rules on products (legacy endpoint)
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
        const allMatch = conditions.every((cond) => matchesCondition(product, cond));

        if (allMatch) {
          const updates = buildUpdatesFromActions(product, actions);
          if (Object.keys(updates).length > 0) {
            await prisma.product.update({ where: { id: product.id }, data: updates });
            affected++;
          }
        }
      }
    }

    await prisma.enrichmentRule.updateMany({
      where: { isActive: true },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    return reply.send({ success: true, data: { affected, rulesApplied: rules.length } });
  });
}
