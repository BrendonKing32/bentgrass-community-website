import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string().optional(),
      coverImage: image().optional(),
      coverImageAlt: z.string().optional(),
    }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      endDate: z.coerce.date().optional(),
      time: z.string().optional(),
      location: z.string().optional(),
      link: z.url().optional(),
      linkLabel: z.string().optional(),
      coverImage: image().optional(),
      coverImageAlt: z.string().optional(),
    }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/newsletters' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    url: z.url().optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    category: z.string(),
    order: z.number().default(0),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    url: z.url(),
    category: z.enum(['emergency-weather', 'safety', 'local-government', 'community-social']),
    order: z.number().default(0),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
  }),
});

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      image: image(),
      category: z.enum(['events', 'critters', 'weather', 'neighborhood']),
      date: z.coerce.date().optional(),
      credit: z.string().optional(),
    }),
});

const businesses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/businesses' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      category: z.enum([
        'home-services',
        'food-drink',
        'health-wellness',
        'childcare-education',
        'pets',
        'professional-services',
        'retail-crafts',
        'other',
      ]),
      summary: z.string(),
      url: z.url().optional(),
      phone: z.string().optional(),
      email: z.email().optional(),
      residentOwned: z.boolean().default(false),
      logo: image().optional(),
      logoAlt: z.string().optional(),
      listed: z.boolean().default(true),
    }),
});

export const collections = { news, events, newsletters, faq, resources, pages, gallery, businesses };
