import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { prisma } from '@pim/db';
import { authRoutes } from './routes/auth';
import { productRoutes } from './routes/products';
import { categoryRoutes } from './routes/categories';
import { taskRoutes } from './routes/tasks';
import { dashboardRoutes } from './routes/dashboard';
import { settingsRoutes } from './routes/settings';
import { promptTemplateRoutes } from './routes/prompt-templates';
import { imageRoutes } from './routes/images';
import { syncRoutes } from './routes/sync';
import { aiRoutes } from './routes/ai';
import { authMiddleware } from './middleware/auth';
import { initBullMQ } from './jobs/queue';
import { trpcPlugin } from './trpc/plugin';

type FastifyError = Error & { statusCode?: number; code?: string };

const PORT = parseInt(process.env.PORT || '4000', 10);

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : process.env.NODE_ENV === 'production'
      ? ['https://pim.fepy.com']
      : ['http://localhost:3000'];

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.some(o => origin.startsWith(o) || origin.endsWith('.vercel.app'))) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Auth decorator
  app.decorate('prisma', prisma);
  await app.register(authMiddleware);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(categoryRoutes, { prefix: '/api/categories' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(promptTemplateRoutes, { prefix: '/api/prompt-templates' });
  await app.register(imageRoutes, { prefix: '/api/images' });
  await app.register(syncRoutes, { prefix: '/api/sync' });
  await app.register(aiRoutes, { prefix: '/api/ai' });

  // tRPC
  await app.register(trpcPlugin);

  // Global error handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      },
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildApp();

    // Init BullMQ workers
    await initBullMQ();

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 PIM API running on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { buildApp };
