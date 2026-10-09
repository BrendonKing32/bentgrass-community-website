import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The CMS saves optional fields left blank as '' — treat that as "not set" rather than failing the build.
const blank = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: blank(z.string()),
      coverImage: blank(image()),
      coverImageAlt: blank(z.string()),
    }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      endDate: blank(z.coerce.date()),
      time: blank(z.string()),
      location: blank(z.string()),
      link: blank(z.url()),
      linkLabel: blank(z.string()),
      coverImage: blank(image()),
      coverImageAlt: blank(z.string()),
    }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/newsletters' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    url: blank(z.url()),
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
    z
      .object({
        title: z.string(),
        // Resident photos live in R2 (uploaded via /admin/gallery), referenced by id and served at
        // /api/gallery/<id>.jpg — never committed to this public repo.
        photo: blank(z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/)),
        width: blank(z.number().int().positive()),
        height: blank(z.number().int().positive()),
        // Site-owned illustrations only (e.g. the placeholder).
        image: blank(image()),
        category: z.enum(['events', 'critters', 'weather', 'neighborhood']),
        date: blank(z.coerce.date()),
        credit: blank(z.string()),
        // Starts the retention clock — see src/lib/gallery-retention.js and /site-info/photo-policy.
        added: blank(z.coerce.date()),
        // Editor confirms the submitter agreed to the Photo Policy (own photo, consent of people shown).
        consent: z.boolean().default(false),
        // Only for site-owned illustrations (e.g. the placeholder) — never for resident photos.
        permanent: z.boolean().default(false),
      })
      .refine((p) => Boolean(p.permanent ? p.image && !p.photo : p.photo && p.width && p.height && p.added && p.consent), {
        message:
          'Resident gallery photos must be added through /admin/gallery (R2 "photo", dimensions, "added" date, "consent: true"). Only site-owned illustrations may set "permanent: true" with a local "image".',
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
      url: blank(z.url()),
      phone: blank(z.string()),
      email: blank(z.email()),
      residentOwned: z.boolean().default(false),
      logo: blank(image()),
      logoAlt: blank(z.string()),
      listed: z.boolean().default(true),
    }),
});

export const collections = { news, events, newsletters, faq, resources, pages, gallery, businesses };
