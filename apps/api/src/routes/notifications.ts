import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    return reply.send({ success: true, data: { notifications, unreadCount } });
  });

  app.patch('/:id/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return reply.send({ success: true, data: { message: 'Marked as read' } });
  });

  app.post('/read-all', { preHandler: [app.authenticate] }, async (req, reply) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return reply.send({ success: true, data: { message: 'All marked as read' } });
  });
}
