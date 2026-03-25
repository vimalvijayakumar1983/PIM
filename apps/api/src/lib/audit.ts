import { prisma } from '@pim/db';

export async function createAuditLog(params: {
  userId: string;
  productId?: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      productId: params.productId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  });
}

export async function logProductFieldChanges(
  userId: string,
  productId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
) {
  const fieldsToTrack = [
    'title', 'metaTitle', 'metaDesc', 'shortDesc', 'longDesc',
    'specs', 'faqs', 'schemaMarkup', 'status', 'costPrice',
    'sellingPrice', 'brand', 'categoryId', 'priority',
  ];

  const logs = [];
  for (const field of fieldsToTrack) {
    if (newData[field] !== undefined && JSON.stringify(oldData[field]) !== JSON.stringify(newData[field])) {
      logs.push(
        createAuditLog({
          userId,
          productId,
          action: 'UPDATE',
          field,
          oldValue: oldData[field] != null ? String(oldData[field]) : undefined,
          newValue: newData[field] != null ? String(newData[field]) : undefined,
        }),
      );
    }
  }

  await Promise.all(logs);
}
