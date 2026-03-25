import { initTRPC, TRPCError } from '@trpc/server';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@pim/types';

interface Context {
  user: JwtPayload | null;
}

function createContext(req: FastifyRequest): Context {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null };
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return { user: payload };
  } catch {
    return { user: null };
  }
}

const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(isAuthenticated);

const appRouter = t.router({
  health: publicProcedure.query(() => ({ status: 'ok' })),

  // Products
  products: t.router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
      }))
      .query(async ({ input }) => {
        const where: any = {};
        if (input.status) where.status = input.status;

        const [items, total] = await Promise.all([
          prisma.product.findMany({
            where,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { updatedAt: 'desc' },
            include: {
              category: { select: { id: true, name: true } },
              images: { where: { isPrimary: true }, take: 1 },
            },
          }),
          prisma.product.count({ where }),
        ]);

        return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
      }),

    byId: protectedProcedure
      .input(z.string())
      .query(async ({ input: id }) => {
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            category: true,
            website: true,
            images: { orderBy: { position: 'asc' } },
          },
        });
        if (!product) throw new TRPCError({ code: 'NOT_FOUND' });
        return product;
      }),
  }),

  // Dashboard
  dashboard: t.router({
    stats: protectedProcedure.query(async () => {
      const [total, pendingReview, published] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { status: { in: ['AI_GENERATED', 'IN_REVIEW'] } } }),
        prisma.product.count({ where: { status: 'PUBLISHED' } }),
      ]);
      return { total, pendingReview, published };
    }),
  }),

  // Categories
  categories: t.router({
    list: protectedProcedure.query(async () => {
      return prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;

export async function trpcPlugin(app: FastifyInstance) {
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }: { req: FastifyRequest }) => createContext(req),
    },
  });
}
