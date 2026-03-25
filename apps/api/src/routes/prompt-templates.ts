import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const templateSchema = z.object({
  name: z.string().min(1),
  titlePrompt: z.string().min(1),
  descPrompt: z.string().min(1),
  specsPrompt: z.string().min(1),
  faqPrompt: z.string().min(1),
  seoPrompt: z.string().min(1),
  preferredModel: z.enum(['claude', 'gemini']).default('claude'),
});

export async function promptTemplateRoutes(app: FastifyInstance) {
  // List templates
  app.get('/', { preHandler: [app.authenticate] }, async (_request, reply) => {
    const templates = await prisma.promptTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { categories: { select: { id: true, name: true } } },
    });
    return reply.send({ success: true, data: templates });
  });

  // Get single template
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = await prisma.promptTemplate.findUnique({
      where: { id },
      include: { categories: true },
    });
    if (!template) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    return reply.send({ success: true, data: template });
  });

  // Create template
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    }
    const template = await prisma.promptTemplate.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: template });
  });

  // Update template (creates new version)
  app.patch('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = templateSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }

    const existing = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    // Deactivate old version
    await prisma.promptTemplate.update({ where: { id }, data: { isActive: false } });

    // Create new version
    const template = await prisma.promptTemplate.create({
      data: {
        name: parsed.data.name || existing.name,
        version: existing.version + 1,
        titlePrompt: parsed.data.titlePrompt || existing.titlePrompt,
        descPrompt: parsed.data.descPrompt || existing.descPrompt,
        specsPrompt: parsed.data.specsPrompt || existing.specsPrompt,
        faqPrompt: parsed.data.faqPrompt || existing.faqPrompt,
        seoPrompt: parsed.data.seoPrompt || existing.seoPrompt,
        preferredModel: parsed.data.preferredModel || existing.preferredModel,
      },
    });

    return reply.send({ success: true, data: template });
  });

  // Preview - run prompt against sample product
  app.post('/preview', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { prompt, sampleProduct } = request.body as { prompt: string; sampleProduct: any };
    if (!prompt || !sampleProduct) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'prompt and sampleProduct required' } });
    }

    // Replace template variables
    const filledPrompt = prompt.replace('{{product}}', JSON.stringify(sampleProduct));

    // Use the AI service for preview
    const { generateWithClaude } = await import('../services/ai');
    try {
      const result = await generateWithClaude(filledPrompt);
      return reply.send({ success: true, data: { result } });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'AI_ERROR', message: err.message },
      });
    }
  });

  // Delete template
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.promptTemplate.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { message: 'Template deactivated' } });
  });
}
