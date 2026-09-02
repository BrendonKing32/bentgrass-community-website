# Bent Grass Neighborhood Website

The Bent Grass / Falcon Meadows community site — rebuilt as a static [Astro](https://astro.build) site, styled with Tailwind CSS, deployed on [Cloudflare Pages](https://pages.cloudflare.com), and editable by volunteers through a browser-based content admin ([Decap CMS](https://decapcms.org)).

Live site: https://www.bentgrassneighborhood.org

## Project structure

```
src/
  content/
    news/          News & Announcements posts (markdown)
    events/        Events (markdown, split into upcoming/past automatically by date)
    newsletters/   Monthly newsletter archive entries
    faq/           FAQ questions, grouped by category
    resources/     General Resources links, grouped by category
    gallery/       Community Gallery photos
    pages/         Longer-form pages (WHMD Information, BGMD Information)
  components/      Reusable Astro components (Header, Footer, cards, etc.)
  layouts/         Page shell (BaseLayout)
  pages/           Routes — mostly thin wrappers that query content/ and render it
public/
  admin/           Decap CMS admin UI (config.yml + index.html)
functions/api/     Cloudflare Pages Functions implementing GitHub OAuth for Decap CMS
```

Every page except the home page and the "district info" pages (WHMD/BGMD) is generated from a **content collection** — adding, editing, or removing a markdown file in `src/content/` is enough to change what's on the site. No code changes needed for routine updates.

## Local development

```sh
npm install
npm run dev          # http://localhost:4321
npm run build         # outputs static site to ./dist
npm run preview       # preview the production build locally
```

This repo's `AGENTS.md` documents running `astro dev --background` for agent-driven workflows.

## Editing content

**Option A — edit markdown directly.** Every collection in `src/content/` is a folder of `.md` files with frontmatter. Copy an existing file as a template, edit it, commit, and push — Cloudflare Pages rebuilds and redeploys automatically.

**Option B — use the content admin at `/admin`.** Once GitHub OAuth is configured (see below), anyone with access to the GitHub repo can go to `https://www.bentgrassneighborhood.org/admin`, log in with GitHub, and add/edit News, Events, Newsletters, FAQ, Resources, and Gallery photos through a form UI. Saving creates a commit directly on the `main` branch, which triggers a rebuild.

## Deployment (Cloudflare Pages)

1. In the Cloudflare dashboard, create a new **Pages** project connected to the `BrendonKing32/bentgrass-community-website` GitHub repo.
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
3. Cloudflare Pages will automatically detect and deploy the `functions/api/*` files as Pages Functions — no extra config needed.
4. Add your custom domain (`www.bentgrassneighborhood.org`, and a redirect from the bare domain) under the Pages project's **Custom domains** tab, then update DNS at your registrar/DNS host to point at Cloudflare (or move the zone to Cloudflare DNS entirely for the simplest setup).
5. Keep the existing Google Sites site live until DNS has fully cut over and you've spot-checked the new site.

## Setting up the content admin (GitHub OAuth)

Decap CMS needs a GitHub OAuth App so it can commit on behalf of logged-in editors. This repo already includes the Cloudflare Pages Functions (`functions/api/auth.js` and `functions/api/callback.js`) that handle the OAuth handshake — you just need to create the OAuth App and set two environment variables.

1. In GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App** (or create it under the organization/account that owns this repo).
   - **Homepage URL:** `https://www.bentgrassneighborhood.org`
   - **Authorization callback URL:** `https://www.bentgrassneighborhood.org/api/callback`
2. Copy the generated **Client ID** and generate a **Client Secret**.
3. In the Cloudflare Pages project settings, under **Environment variables**, add (for the Production environment):
   - `GITHUB_OAUTH_CLIENT_ID`
   - `GITHUB_OAUTH_CLIENT_SECRET`
4. Redeploy. Anyone with **write access to the GitHub repo** can now sign in at `/admin` and edit content. (Decap's GitHub backend authorizes based on repo permissions — there's no separate user list to manage.)

## Content notes

- **Events** are automatically sorted into "Upcoming" and "Past" based on the event's `date` (or `endDate`, for multi-day events) compared to the time of the most recent build. Since this is a static site, "today" only updates when the site rebuilds — pushing any commit (or editing content through `/admin`) triggers a rebuild.
- **Gallery** starts empty with a "submit a photo" call to action. Add photos either via `/admin` (uploads go to `public/images/uploads/`) or by adding files directly and committing.
- The **FAQ** and **General Resources** pages are grouped by a `category` field — see `src/content.config.ts` for the fixed set of category values each collection accepts.
