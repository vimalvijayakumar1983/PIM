import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@pim/db';
import { generateProductContent } from '../services/ai';

let aiQueue: Queue;
let connection: IORedis;

export function getAIQueue(): Queue {
  if (!aiQueue) {
    throw new Error('BullMQ not initialized. Call initBullMQ() first.');
  }
  return aiQueue;
}

const DEFAULT_PROMPT_TEMPLATE = {
  titlePrompt: 'Generate a product title. Include brand, product type, key spec. 50-70 chars. Product: {{product}}',
  descPrompt: 'Write a compelling product description for e-commerce. 200-400 words HTML. Product: {{product}}',
  specsPrompt: 'Extract specifications as {label, value} pairs. Product: {{product}}',
  faqPrompt: 'Generate 3-5 FAQs about installation, compatibility, maintenance. Product: {{product}}',
  seoPrompt: 'Generate meta title (50-60 chars) and meta description (150-160 chars). Product: {{product}}',
};

export async function initBullMQ() {
  const redisUrl = process.env.REDIS_URL || '';

  if (!redisUrl) {
    console.warn('REDIS_URL not set — BullMQ disabled, using mock queue');
    aiQueue = {
      add: async () => ({ id: 'mock-' + Date.now() }),
      getJob: async () => null,
    } as any;
    return;
  }

  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 1000, 3000);
      },
    });

    aiQueue = new Queue('ai-content-generation', { connection });

    const worker = new Worker(
      'ai-content-generation',
      async (job) => {
        const { productId, model } = job.data as { productId: string; model: 'claude' | 'gemini' };

        await job.updateProgress(10);

        // Load product with category and prompt template
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: {
            category: {
              include: { promptTemplate: true },
            },
          },
        });

        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        await job.updateProgress(20);

        const promptTemplate = product.category?.promptTemplate || DEFAULT_PROMPT_TEMPLATE;

        // Generate content
        const content = await generateProductContent(
          product,
          promptTemplate,
          model,
        );

        await job.updateProgress(80);

        // Update product with AI-generated content
        await prisma.product.update({
          where: { id: productId },
          data: {
            aiTitle: content.title,
            aiMetaTitle: content.metaTitle,
            aiMetaDesc: content.metaDescription,
            aiShortDesc: content.shortDescription,
            aiLongDesc: content.longDescription,
            aiSpecs: content.specifications as any,
            aiFaqs: content.faqs as any,
            aiSchemaMarkup: content.schemaMarkup as any,
            aiModel: model,
            aiGeneratedAt: new Date(),
            status: 'AI_GENERATED',
          },
        });

        await job.updateProgress(100);

        return { productId, model, success: true };
      },
      {
        connection,
        concurrency: 3,
      },
    );

    worker.on('completed', (job) => {
      console.log(`AI job ${job.id} completed for product ${job.data.productId}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`AI job ${job?.id} failed:`, err.message);
    });

    console.log('BullMQ initialized with AI content generation worker');
  } catch (err) {
    console.warn('BullMQ initialization failed (Redis may not be available):', (err as Error).message);
    // Create a mock queue for development without Redis
    aiQueue = {
      add: async () => ({ id: 'mock-' + Date.now() }),
      getJob: async () => null,
    } as any;
  }
}
