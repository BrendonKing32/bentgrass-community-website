import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Sveltia CMS saves cleared optional fields as '' — treat that as "not set"
// so z.url()/z.email()/image() don't reject it.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: optional(z.string()),
      coverImage: optional(image()),
      coverImageAlt: optional(z.string()),
    }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      endDate: optional(z.coerce.date()),
      time: optional(z.string()),
      location: optional(z.string()),
      link: optional(z.url()),
      linkLabel: optional(z.string()),
      coverImage: optional(image()),
      coverImageAlt: optional(z.string()),
    }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/newsletters' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    url: optional(z.url()),
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
      date: optional(z.coerce.date()),
      credit: optional(z.string()),
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
      url: optional(z.url()),
      phone: optional(z.string()),
      email: optional(z.email()),
      residentOwned: z.boolean().default(false),
      logo: optional(image()),
      logoAlt: optional(z.string()),
      listed: z.boolean().default(true),
    }),
});

export const collections = { news, events, newsletters, faq, resources, pages, gallery, businesses };
