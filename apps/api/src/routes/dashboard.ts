import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/stats', { preHandler: [app.authenticate] }, async (_request, reply) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalProducts,
      publishedToday,
      pendingReview,
      aiGeneratedLast24h,
      failedSyncs,
      lastSynced,
      statusCounts,
      tasksByUser,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'PUBLISHED', updatedAt: { gte: todayStart } } }),
      prisma.product.count({ where: { status: { in: ['AI_GENERATED', 'IN_REVIEW'] } } }),
      prisma.product.count({ where: { aiGeneratedAt: { gte: last24h } } }),
      prisma.product.count({ where: { syncStatus: 'FAILED' } }),
      prisma.product.findFirst({ where: { lastSyncedAt: { not: null } }, orderBy: { lastSyncedAt: 'desc' }, select: { lastSyncedAt: true } }),
      prisma.product.groupBy({ by: ['status'], _count: true }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: { status: 'DONE', completedAt: { gte: weekAgo } },
        _count: true,
      }),
    ]);

    // Get user names for task stats
    const userIds = tasksByUser.map((t) => t.assignedToId).filter(Boolean) as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];

    const teamProductivity = tasksByUser
      .filter((t) => t.assignedToId)
      .map((t) => {
        const user = users.find((u) => u.id === t.assignedToId);
        return { userId: t.assignedToId, name: user?.name || 'Unknown', completedTasks: t._count };
      });

    return reply.send({
      success: true,
      data: {
        totalProducts,
        publishedToday,
        pendingReview,
        aiGeneratedLast24h,
        failedSyncs,
        lastSyncTime: lastSynced?.lastSyncedAt?.toISOString() || null,
        statusFunnel: statusCounts.map((s) => ({ status: s.status, count: s._count })),
        teamProductivity,
      },
    });
  });
}
