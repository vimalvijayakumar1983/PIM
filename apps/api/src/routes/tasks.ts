import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const createTaskSchema = z.object({
  productId: z.string(),
  assignedToId: z.string().optional(),
  type: z.enum(['ENRICH_CONTENT', 'REVIEW_CONTENT', 'APPROVE_PRICING', 'UPLOAD_IMAGES', 'PUBLISH']),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateTaskSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const taskFilterSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  assignedToId: z.string().optional(),
  type: z.enum(['ENRICH_CONTENT', 'REVIEW_CONTENT', 'APPROVE_PRICING', 'UPLOAD_IMAGES', 'PUBLISH']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(200).default(50),
});

export async function taskRoutes(app: FastifyInstance) {
  // List tasks
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = taskFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid filters' } });
    }

    const { status, assignedToId, type, page, pageSize } = parsed.data;
    const where: any = {};
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, rawTitle: true, title: true, status: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return reply.send({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  // My tasks
  app.get('/my', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: request.user!.userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        product: { select: { id: true, sku: true, rawTitle: true, title: true, status: true } },
      },
    });
    return reply.send({ success: true, data: tasks });
  });

  // Create task
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    }

    const task = await prisma.task.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: task });
  });

  // Update task
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }

    const data: any = { ...parsed.data };
    if (data.status === 'DONE') {
      data.completedAt = new Date();
    }
    if (data.dueDate) {
      data.dueDate = new Date(data.dueDate);
    }

    const task = await prisma.task.update({ where: { id }, data });
    return reply.send({ success: true, data: task });
  });

  // Bulk assign
  app.post('/bulk-assign', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { categoryId, assignedToId, type } = request.body as {
      categoryId: string;
      assignedToId: string;
      type: string;
    };

    const products = await prisma.product.findMany({
      where: { categoryId, status: 'DRAFT' },
      select: { id: true },
    });

    const tasks = await prisma.task.createMany({
      data: products.map((p) => ({
        productId: p.id,
        assignedToId,
        type: type as any,
        status: 'PENDING' as const,
      })),
    });

    return reply.send({ success: true, data: { created: tasks.count } });
  });

  // Delete task
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.task.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Task deleted' } });
  });
}
