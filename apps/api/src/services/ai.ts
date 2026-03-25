import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIContentOutput } from '@pim/types';

export async function generateWithClaude(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateProductContent(
  product: {
    sku: string;
    rawTitle?: string | null;
    rawDescription?: string | null;
    rawSpecs?: unknown;
    brand?: string | null;
  },
  promptTemplate: {
    titlePrompt: string;
    descPrompt: string;
    specsPrompt: string;
    faqPrompt: string;
    seoPrompt: string;
  },
  model: 'claude' | 'gemini' = 'claude',
): Promise<AIContentOutput> {
  const productData = JSON.stringify({
    sku: product.sku,
    title: product.rawTitle,
    description: product.rawDescription,
    specs: product.rawSpecs,
    brand: product.brand,
  });

  const generate = model === 'claude' ? generateWithClaude : generateWithGemini;

  const systemPrompt = `You are an expert e-commerce content writer for a building materials store.
Always respond with valid JSON matching the requested format. Do not include markdown code fences.`;

  const fullPrompt = `${systemPrompt}

Generate complete product content as a single JSON object with these fields:
- title (string, 50-70 chars, include brand + product type + key spec)
- metaTitle (string, 50-60 chars, SEO optimized)
- metaDescription (string, 150-160 chars)
- shortDescription (string, 1-2 sentences, benefit-led)
- longDescription (string, 200-400 words, HTML formatted with proper tags)
- specifications (array of {label, value} objects)
- faqs (array of {question, answer} objects, 3-5 items)
- schemaMarkup (JSON-LD Product schema object)

Product data: ${productData}

Title prompt guidance: ${promptTemplate.titlePrompt.replace('{{product}}', productData)}
Description guidance: ${promptTemplate.descPrompt.replace('{{product}}', productData)}`;

  try {
    const result = await generate(fullPrompt);

    // Try to parse JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIContentOutput;
    return parsed;
  } catch (err) {
    // Fallback to other model
    if (model === 'claude') {
      console.log('Claude failed, falling back to Gemini');
      return generateProductContent(product, promptTemplate, 'gemini');
    }
    throw err;
  }
}
