import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { z } from 'zod';

const familySchema = z.object({
  label: z.string().min(1),
  code: z.string().min(1),
  standardUnit: z.string().min(1),
});

const unitSchema = z.object({
  label: z.string().min(1),
  code: z.string().min(1),
  symbol: z.string().min(1),
  familyId: z.string(),
  conversionFactor: z.number().default(1),
});

export async function measurementRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const families = await prisma.measurementFamily.findMany({
      include: { units: { orderBy: { label: 'asc' } } },
      orderBy: { label: 'asc' },
    });
    return reply.send({ success: true, data: families });
  });

  app.post('/families', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = familySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const family = await prisma.measurementFamily.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: family });
  });

  app.post('/units', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (req, reply) => {
    const parsed = unitSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    const unit = await prisma.measurementUnit.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: unit });
  });

  app.post('/convert', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { value, fromUnit, toUnit, familyCode } = req.body as {
      value: number; fromUnit: string; toUnit: string; familyCode: string;
    };
    const family = await prisma.measurementFamily.findUnique({
      where: { code: familyCode },
      include: { units: true },
    });
    if (!family) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Measurement family not found' } });

    const from = family.units.find((u: { code: string }) => u.code === fromUnit);
    const to = family.units.find((u: { code: string }) => u.code === toUnit);
    if (!from || !to) return reply.status(400).send({ success: false, error: { code: 'INVALID_UNIT', message: 'Unit not found' } });

    const standardValue = value * Number(from.conversionFactor);
    const result = standardValue / Number(to.conversionFactor);
    return reply.send({ success: true, data: { result, from: fromUnit, to: toUnit } });
  });
}
