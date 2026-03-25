import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default super admin
  const passwordHash = await hash('admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pim.local' },
    update: {},
    create: {
      email: 'admin@pim.local',
      name: 'Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create default website
  const website = await prisma.website.upsert({
    where: { domain: 'fepy.com' },
    update: {},
    create: {
      name: 'Fepy',
      domain: 'fepy.com',
      platform: 'magento2',
      apiUrl: 'https://fepy.com/rest/V1',
      apiToken: 'placeholder-token',
      isActive: true,
    },
  });
  console.log(`Created website: ${website.domain}`);

  // Create default categories
  const categories = [
    { name: 'Building Materials', slug: 'building-materials' },
    { name: 'Plumbing', slug: 'plumbing' },
    { name: 'Electrical', slug: 'electrical' },
    { name: 'Tools & Hardware', slug: 'tools-hardware' },
    { name: 'Paint & Finishes', slug: 'paint-finishes' },
    { name: 'Flooring', slug: 'flooring' },
    { name: 'Doors & Windows', slug: 'doors-windows' },
    { name: 'Kitchen & Bath', slug: 'kitchen-bath' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`Created ${categories.length} categories`);

  // Create default prompt template
  const template = await prisma.promptTemplate.create({
    data: {
      name: 'Default Building Materials',
      titlePrompt: 'Generate a product title for a building materials product. Include the brand name, product type, and key specification. Keep it between 50-70 characters. Product data: {{product}}',
      descPrompt: 'Write a compelling product description for an e-commerce building materials store. Include benefits, use cases, and key features. Write 200-400 words in HTML format. Product data: {{product}}',
      specsPrompt: 'Extract and format product specifications as a JSON array of {label, value} pairs. Include dimensions, material, weight, color, and any technical specs. Product data: {{product}}',
      faqPrompt: 'Generate 3-5 frequently asked questions and answers for this building materials product. Focus on installation, compatibility, and maintenance. Product data: {{product}}',
      seoPrompt: 'Generate SEO metadata: meta title (50-60 chars) and meta description (150-160 chars) optimized for search. Product data: {{product}}',
      preferredModel: 'claude',
    },
  });
  console.log(`Created prompt template: ${template.name}`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
