import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { createAuditLog } from '../lib/audit';

export async function syncRoutes(app: FastifyInstance) {
  // Push product to Magento
  app.post('/push/:productId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { website: true, images: { orderBy: { position: 'asc' } } },
    });

    if (!product) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    if (product.status !== 'APPROVED' && product.status !== 'PUBLISHED') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Product must be APPROVED or PUBLISHED to sync' },
      });
    }

    try {
      // Call Magento REST API
      const magentoPayload = {
        product: {
          sku: product.sku,
          name: product.title,
          attribute_set_id: 4, // Default attribute set
          price: product.sellingPrice ? Number(product.sellingPrice) : 0,
          status: 1,
          visibility: 4,
          type_id: 'simple',
          custom_attributes: [
            { attribute_code: 'description', value: product.longDesc || '' },
            { attribute_code: 'short_description', value: product.shortDesc || '' },
            { attribute_code: 'meta_title', value: product.metaTitle || '' },
            { attribute_code: 'meta_description', value: product.metaDesc || '' },
          ],
        },
      };

      const magentoResponse = await fetch(`${product.website.apiUrl}/products`, {
        method: product.magentoId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${product.website.apiToken}`,
        },
        body: JSON.stringify(magentoPayload),
      });

      if (!magentoResponse.ok) {
        const errorBody = await magentoResponse.text();
        throw new Error(`Magento API error: ${magentoResponse.status} - ${errorBody}`);
      }

      const magentoData = await magentoResponse.json() as any;

      await prisma.product.update({
        where: { id: productId },
        data: {
          magentoId: String(magentoData.id || product.magentoId),
          lastSyncedAt: new Date(),
          syncStatus: 'SYNCED',
          status: 'PUBLISHED',
        },
      });

      await createAuditLog({
        userId: request.user!.userId,
        productId,
        action: 'SYNC_PUSH',
        newValue: 'SYNCED',
      });

      return reply.send({ success: true, data: { message: 'Product synced to Magento' } });
    } catch (err: any) {
      await prisma.product.update({
        where: { id: productId },
        data: { syncStatus: 'FAILED' },
      });

      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_FAILED', message: err.message },
      });
    }
  });

  // Pull products from Magento
  app.post('/pull/:websiteId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN')],
  }, async (request, reply) => {
    const { websiteId } = request.params as { websiteId: string };
    const website = await prisma.website.findUnique({ where: { id: websiteId } });

    if (!website) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Website not found' } });
    }

    try {
      const response = await fetch(
        `${website.apiUrl}/products?searchCriteria[pageSize]=100&searchCriteria[currentPage]=1`,
        {
          headers: { Authorization: `Bearer ${website.apiToken}` },
        },
      );

      if (!response.ok) {
        throw new Error(`Magento API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const products = data.items || [];
      let imported = 0;

      for (const mp of products) {
        const desc = mp.custom_attributes?.find((a: any) => a.attribute_code === 'description');
        const shortDesc = mp.custom_attributes?.find((a: any) => a.attribute_code === 'short_description');

        await prisma.product.upsert({
          where: { sku: mp.sku },
          update: {
            magentoId: String(mp.id),
            rawTitle: mp.name,
            rawDescription: desc?.value,
            sellingPrice: mp.price,
          },
          create: {
            sku: mp.sku,
            websiteId,
            magentoId: String(mp.id),
            rawTitle: mp.name,
            rawDescription: desc?.value,
            sellingPrice: mp.price,
          },
        });
        imported++;
      }

      return reply.send({ success: true, data: { imported, total: products.length } });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'PULL_FAILED', message: err.message },
      });
    }
  });

  // Sync status overview
  app.get('/status', {
    preHandler: [app.authenticate],
  }, async (_request, reply) => {
    const counts = await prisma.product.groupBy({
      by: ['syncStatus'],
      _count: true,
    });

    const lastSync = await prisma.product.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true, sku: true },
    });

    return reply.send({
      success: true,
      data: {
        counts: counts.map((c: { syncStatus: string; _count: number }) => ({ status: c.syncStatus, count: c._count })),
        lastSync: lastSync ? { time: lastSync.lastSyncedAt, sku: lastSync.sku } : null,
      },
    });
  });
}
