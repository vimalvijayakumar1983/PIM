import type { SEOValidationResult } from '@pim/types';

export function validateSEO(product: {
  title?: string | null;
  metaTitle?: string | null;
  metaDesc?: string | null;
  longDesc?: string | null;
  schemaMarkup?: unknown;
}): SEOValidationResult {
  const issues: SEOValidationResult['issues'] = [];
  let score = 100;

  // Title validation
  if (!product.title) {
    issues.push({ field: 'title', severity: 'error', message: 'Product title is missing' });
    score -= 25;
  } else if (product.title.length < 20) {
    issues.push({ field: 'title', severity: 'warning', message: 'Title is too short (recommended: 50-70 chars)' });
    score -= 10;
  } else if (product.title.length > 80) {
    issues.push({ field: 'title', severity: 'warning', message: 'Title is too long (recommended: 50-70 chars)' });
    score -= 5;
  }

  // Meta title validation
  if (!product.metaTitle) {
    issues.push({ field: 'metaTitle', severity: 'error', message: 'Meta title is missing' });
    score -= 20;
  } else if (product.metaTitle.length < 50) {
    issues.push({ field: 'metaTitle', severity: 'warning', message: 'Meta title too short (recommended: 50-60 chars)' });
    score -= 5;
  } else if (product.metaTitle.length > 60) {
    issues.push({ field: 'metaTitle', severity: 'warning', message: 'Meta title too long (recommended: 50-60 chars)' });
    score -= 5;
  }

  // Meta description validation
  if (!product.metaDesc) {
    issues.push({ field: 'metaDesc', severity: 'error', message: 'Meta description is missing' });
    score -= 20;
  } else if (product.metaDesc.length < 150) {
    issues.push({ field: 'metaDesc', severity: 'warning', message: 'Meta description too short (recommended: 150-160 chars)' });
    score -= 5;
  } else if (product.metaDesc.length > 160) {
    issues.push({ field: 'metaDesc', severity: 'warning', message: 'Meta description too long (recommended: 150-160 chars)' });
    score -= 5;
  }

  // Long description - check for H1
  if (!product.longDesc) {
    issues.push({ field: 'longDesc', severity: 'warning', message: 'Long description is missing' });
    score -= 10;
  } else if (!product.longDesc.includes('<h1') && !product.longDesc.includes('<H1')) {
    issues.push({ field: 'longDesc', severity: 'warning', message: 'No H1 tag found in long description' });
    score -= 5;
  }

  // Schema markup validation
  if (!product.schemaMarkup) {
    issues.push({ field: 'schemaMarkup', severity: 'warning', message: 'Schema markup is missing' });
    score -= 10;
  } else {
    try {
      const markup = typeof product.schemaMarkup === 'string'
        ? JSON.parse(product.schemaMarkup)
        : product.schemaMarkup;
      if (!markup['@context'] || !markup['@type']) {
        issues.push({ field: 'schemaMarkup', severity: 'error', message: 'Invalid JSON-LD: missing @context or @type' });
        score -= 10;
      }
    } catch {
      issues.push({ field: 'schemaMarkup', severity: 'error', message: 'Schema markup is not valid JSON' });
      score -= 15;
    }
  }

  return { score: Math.max(0, score), issues };
}
