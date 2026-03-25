import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function notificationRoutes(app: FastifyInstance) {
  // Get notifications for current user (paginated, unread first)
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = paginationSchema.safeParse(req.query);
    const { page, pageSize } = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

    const userId = req.user!.userId;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return reply.send({
      success: true,
      data: {
        notifications,
        unreadCount,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  });

  // Mark notification as read
  app.patch('/:id/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    if (notification.userId !== req.user!.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your notification' },
      });
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return reply.send({ success: true, data: { message: 'Marked as read' } });
  });

  // Mark all notifications as read for current user
  app.post('/mark-all-read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return reply.send({
      success: true,
      data: { message: 'All marked as read', count: result.count },
    });
  });

  // Get count of unread notifications
  app.get('/unread-count', { preHandler: [app.authenticate] }, async (req, reply) => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    return reply.send({ success: true, data: { unreadCount: count } });
  });

  // Legacy: mark all read (backward compat)
  app.post('/read-all', { preHandler: [app.authenticate] }, async (req, reply) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return reply.send({ success: true, data: { message: 'All marked as read' } });
  });
}
