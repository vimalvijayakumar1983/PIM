import { z } from 'zod';

export const productFilterSchema = z.object({
  status: z.enum(['DRAFT', 'AI_GENERATED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  websiteId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(200).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProductFilter = z.infer<typeof productFilterSchema>;

export const createProductSchema = z.object({
  sku: z.string().min(1),
  websiteId: z.string(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  rawTitle: z.string().optional(),
  rawDescription: z.string().optional(),
  rawSpecs: z.any().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const updateProductSchema = z.object({
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['DRAFT', 'AI_GENERATED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  rawTitle: z.string().optional(),
  rawDescription: z.string().optional(),
  rawSpecs: z.any().optional(),
  title: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  shortDesc: z.string().optional(),
  longDesc: z.string().optional(),
  specs: z.any().optional(),
  faqs: z.any().optional(),
  schemaMarkup: z.any().optional(),
  costPrice: z.number().optional(),
  sellingPrice: z.number().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export interface AIContentOutput {
  title: string;
  metaTitle: string;
  metaDescription: string;
  shortDescription: string;
  longDescription: string;
  specifications: Array<{ label: string; value: string }>;
  faqs: Array<{ question: string; answer: string }>;
  schemaMarkup: Record<string, unknown>;
}

export interface SEOValidationResult {
  score: number;
  issues: Array<{
    field: string;
    severity: 'warning' | 'error';
    message: string;
  }>;
}
