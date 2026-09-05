## Project at a glance

Static [Astro](https://astro.build) site styled with Tailwind CSS v4, deployed as a Cloudflare Worker (static assets + a small Worker for OAuth/newsletter endpoints), content-edited via Sveltia CMS at `/admin`. See [README.md](README.md) "Project structure" for the full directory layout, deployment steps, and CMS/OAuth setup — this file only covers what isn't already there.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

`npm run dev` only runs Astro — it does **not** load `functions/api/`. To exercise those endpoints locally, use `npm run preview` (full `wrangler dev` worker) instead.

There is no test suite or linter configured (no `npm test`/`npm run lint`). Verify TypeScript changes with `npx astro check` (strict mode, via `tsconfig.json` extending `astro/tsconfigs/strict`).

`npm run build` runs `astro build && wrangler pages functions build --outdir=./dist/_worker.js/` — if changes under `functions/api/` aren't showing up, check that second step ran.

## Content collections

Collections and their schemas are defined in [src/content.config.ts](src/content.config.ts) — the single source of truth for required fields and the fixed `category` enums (`faq`, `resources`, `gallery`). Adding or editing a markdown file under `src/content/<collection>/` is enough for routine content changes; no code changes needed. See README "Content notes" for how events are sorted into Upcoming/Past.

## Styling conventions

Tailwind v4 theme lives in the `@theme` block of [src/styles/global.css](src/styles/global.css) (there's no `tailwind.config.js`) — custom color scales `brand-*`/`accent-*` and fonts `font-sans` (Inter) / `font-display` (Fraunces, used for headings). Use `class:list={[...]}` for conditional classes, as in [src/components/EventCard.astro](src/components/EventCard.astro).

## Cloudflare Pages Functions (`functions/api/`)

These are Cloudflare Pages Functions (`onRequestGet`/`onRequestPost` exports), not Node/Express handlers. See the `cloudflare-pages-functions` skill for the handler pattern, and README "Setting up the content admin" / "Newsletter" for the required secrets.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
