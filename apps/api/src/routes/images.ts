import type { FastifyInstance } from 'fastify';
import { prisma } from '@pim/db';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  });
}

export async function imageRoutes(app: FastifyInstance) {
  // Upload image for a product
  app.post('/:productId/upload', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'CATALOGER')],
  }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const ext = data.filename.split('.').pop() || 'jpg';
    const key = `products/${productId}/${randomUUID()}.${ext}`;

    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: data.mimetype,
    }));

    const imageCount = await prisma.productImage.count({ where: { productId } });
    const image = await prisma.productImage.create({
      data: {
        productId,
        url: key,
        isPrimary: imageCount === 0,
        position: imageCount,
      },
    });

    return reply.status(201).send({ success: true, data: image });
  });

  // Get signed URL for an image
  app.get('/signed-url/:imageId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
    }

    const s3 = getS3Client();
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: image.url,
    }), { expiresIn: 3600 });

    return reply.send({ success: true, data: { url } });
  });

  // Set primary image
  app.patch('/:imageId/primary', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
    }

    await prisma.productImage.updateMany({ where: { productId: image.productId }, data: { isPrimary: false } });
    await prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });

    return reply.send({ success: true, data: { message: 'Primary image updated' } });
  });

  // Reorder images
  app.post('/:productId/reorder', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const { imageIds } = request.body as { imageIds: string[] };

    const updates = imageIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { position: index } }),
    );
    await Promise.all(updates);

    return reply.send({ success: true, data: { message: 'Images reordered' } });
  });

  // Delete image
  app.delete('/:imageId', {
    preHandler: [app.authenticate, app.requireRole('SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER')],
  }, async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
    }

    try {
      const s3 = getS3Client();
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: image.url,
      }));
    } catch {
      // Continue even if S3 delete fails
    }

    await prisma.productImage.delete({ where: { id: imageId } });
    return reply.send({ success: true, data: { message: 'Image deleted' } });
  });
}
