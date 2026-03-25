import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { getAIQueue } from '../jobs/queue';

export async function aiRoutes(app: FastifyInstance) {
  // Generate AI content for a single product
  app.post('/generate/:productId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const { model } = request.body as { model?: 'claude' | 'gemini' };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: { include: { promptTemplate: true } } },
    });

    if (!product) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    const queue = getAIQueue();
    const job = await queue.add('generate-content', {
      productId,
      model: model || product.category?.promptTemplate?.preferredModel || 'claude',
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return reply.send({
      success: true,
      data: { jobId: job.id, message: 'AI generation job queued' },
    });
  });

  // Bulk generate for multiple products
  app.post('/generate-bulk', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { productIds, model } = request.body as { productIds: string[]; model?: 'claude' | 'gemini' };

    if (!productIds || productIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'productIds array required' },
      });
    }

    const queue = getAIQueue();
    const jobs = await Promise.all(
      productIds.map((productId) =>
        queue.add('generate-content', {
          productId,
          model: model || 'gemini', // Default to gemini for bulk
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      ),
    );

    return reply.send({
      success: true,
      data: {
        jobCount: jobs.length,
        jobIds: jobs.map((j) => j.id),
        message: `${jobs.length} AI generation jobs queued`,
      },
    });
  });

  // Get job status
  app.get('/job/:jobId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const queue = getAIQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    const state = await job.getState();
    const progress = job.progress;

    return reply.send({
      success: true,
      data: { jobId, state, progress, data: job.data, result: job.returnvalue },
    });
  });
}
