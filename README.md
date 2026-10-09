# Bent Grass Neighborhood Website

The Bent Grass / Falcon Meadows community site — rebuilt as a static [Astro](https://astro.build) site, styled with Tailwind CSS, deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) (static assets + a small Worker for the content-admin login flow), and editable by volunteers through a browser-based content admin ([Sveltia CMS](https://github.com/sveltia/sveltia-cms)).

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
    businesses/    Business Directory listings (pilot), grouped by category
  components/      Reusable Astro components (Header, Footer, cards, etc.)
  layouts/         Page shell (BaseLayout)
  pages/           Routes — mostly thin wrappers that query content/ and render it
public/
  admin/           Sveltia CMS admin UI (config.yml + index.html)
  _headers         Response headers for all static assets (currently noindex)
functions/api/     GitHub OAuth handlers + the newsletter signup endpoint, written as Pages
                   Functions and compiled into the Worker at build time
```

Every page except the home page and the "district info" pages (WHMD/BGMD) is generated from a **content collection** — adding, editing, or removing a markdown file in `src/content/` is enough to change what's on the site. No code changes needed for routine updates.

## Local development

```sh
npm install
npm run dev          # Astro dev server at http://localhost:4321 (fast iteration, no OAuth functions)
npm run build         # astro build, then compiles functions/api/* into ./dist/_worker.js
npm run preview       # runs the full Worker locally via `wrangler dev` (assets + OAuth functions)
npm run deploy        # `wrangler deploy` — ships the current ./dist build to Cloudflare
```

This repo's `AGENTS.md` documents running `astro dev --background` for agent-driven workflows.

## Editing content

**Option A — edit markdown directly.** Every collection in `src/content/` is a folder of `.md` files with frontmatter. Copy an existing file as a template, edit it, commit, and push — the connected Cloudflare Workers Build rebuilds and redeploys automatically.

**Option B — use the content admin at `/admin`.** Once GitHub OAuth is configured (see below), anyone with access to the GitHub repo can go to `https://www.bentgrassneighborhood.org/admin`, log in with GitHub, and add/edit News, Events, Newsletters, FAQ, Resources, Gallery captions, and Business Directory listings through a form UI (gallery photos themselves are added at `/admin/gallery` — see "Gallery photo storage"). Saving creates a commit directly on the `main` branch, which triggers a rebuild.

Step-by-step, per-collection guides (field references, examples, and common gotchas) live in the [repo wiki](https://github.com/BrendonKing32/bentgrass-community-website/wiki).

## Deployment (Cloudflare Workers)

This site deploys as a **Worker with static assets** (Cloudflare's current recommended setup — Pages projects now deploy on the same underlying infrastructure). `wrangler.jsonc` at the repo root defines the Worker: it serves everything in `./dist` as static assets, and routes `/api/auth` and `/api/callback` (compiled from `functions/api/`) to the OAuth Worker code.

**One-time setup — connect the repo for automatic deploys:**

1. In the Cloudflare dashboard, go to **Workers & Pages → Create application → Import a repository**, and connect the `BrendonKing32/bentgrass-community-website` GitHub repo.
2. Cloudflare will detect `wrangler.jsonc` and pre-fill the build/deploy commands. Confirm:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
3. Select **Save and Deploy**. Every push to `main` now triggers a **Workers Build** that rebuilds and redeploys automatically (Settings → Builds on the Worker if you need to change the branch later).
4. Once your domain's DNS zone is active on Cloudflare, add the custom domain: Worker → **Settings → Domains & Routes → Add → Custom Domain**, enter `www.bentgrassneighborhood.org`. (You can also uncomment the `routes` block already sketched out in `wrangler.jsonc` and let a deploy create it instead.) Add a redirect rule from the bare domain to `www` under the zone's **Rules → Redirect Rules**.
5. Keep the existing Google Sites site live until DNS has fully cut over and you've spot-checked the new site.

**Search engine indexing is off.** `public/_headers` sends `X-Robots-Tag: noindex` on every page and file, so search engines won't list the site. `robots.txt` still allows crawling on purpose, because a crawler has to fetch a page to see the header. Delete that rule from `public/_headers` when the site should appear in search results.

**Manual/one-off deploys** (no git push needed): `npm run build && npm run deploy` from your machine, using an authenticated `wrangler` (run `npx wrangler login` once).

## Setting up the content admin (GitHub OAuth)

Sveltia CMS needs a GitHub OAuth App so it can commit on behalf of logged-in editors. This repo already includes the OAuth handlers (`functions/api/auth.js` and `functions/api/callback.js`), compiled into the Worker at build time — you just need to create the OAuth App and set two secrets on the Worker.

The Homepage/callback URLs below, and `base_url` in `public/admin/config.yml`, must all point at whatever origin the site is actually reachable at **right now**. Until `www.bentgrassneighborhood.org` is wired up, that's `https://bentgrass.bkbuilds.dev` — the origin `/admin` is opened on — and using the wrong one breaks the login popup. Once the custom domain goes live, update both (see "Switching to the custom domain" below).

1. In GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App** (or create it under the organization/account that owns this repo).
   - **Homepage URL:** `https://bentgrass.bkbuilds.dev`
   - **Authorization callback URL:** `https://bentgrass.bkbuilds.dev/api/callback`
2. Copy the generated **Client ID** and generate a **Client Secret**.
3. Set them as Worker secrets — either via the dashboard (Worker → **Settings → Variables and Secrets → Add**, type **Secret**) or from the CLI:
   ```sh
   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
   ```
4. Secrets set via the dashboard trigger a redeploy automatically; via Wrangler, `secret put` deploys immediately. Because this repository is public, the OAuth flow requests only the `public_repo` scope instead of access to all of an editor's repositories; it does not request the `user` scope. Anyone with **write access to the GitHub repo** can sign in at `/admin` and edit content. (Sveltia's GitHub backend authorizes based on repo permissions — there's no separate user list to manage.)

### Switching to the custom domain

Once `www.bentgrassneighborhood.org` is wired up (see "Deployment" above) and serving the site, admin login needs to move over too:

1. In the GitHub OAuth App's settings, update **Homepage URL** and **Authorization callback URL** to use `https://www.bentgrassneighborhood.org` instead of `https://bentgrass.bkbuilds.dev`.
2. In `public/admin/config.yml`, update `base_url` to `https://www.bentgrassneighborhood.org` and remove the `TODO` comment above it, then commit and push.
3. The Client ID/Secret themselves don't change — no need to regenerate or re-run `wrangler secret put`.

`/admin` will only work against the one origin currently set in `config.yml`.

## Newsletter (Buttondown)

The "Subscribe to the newsletter" form on the home page and the Monthly Newsletters page posts to `/api/subscribe` (`functions/api/subscribe.js`), which creates the subscriber directly through [Buttondown's API](https://docs.buttondown.com/api-subscribers-create). Buttondown owns the subscriber list, the double opt-in confirmation email, sending issues, and per-subscriber unsubscribe links — this site never sees or stores the list itself.

- **API key:** set the `BUTTONDOWN_API_KEY` secret with `npx wrangler secret put BUTTONDOWN_API_KEY` (a Buttondown API key, from your Buttondown account's API settings). Without it, the signup form redirects with an error.
- **Spam protection:** the signup form has a hidden honeypot field; bots that fill it in get a fake "success" redirect without ever calling Buttondown.
- **Bot protection (Turnstile):** the form includes a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) widget, verified server-side in `subscribe.js`. Create a widget in the Cloudflare dashboard (Turnstile), set `PUBLIC_TURNSTILE_SITE_KEY` as a build variable, and run `npx wrangler secret put TURNSTILE_SECRET_KEY`. Without the secret, verification is skipped. For crawlers site-wide, also enable **Bot Fight Mode** (Security → Bots) on the zone once the custom domain is active — it's a dashboard toggle, no code.
- **Local development:** add `BUTTONDOWN_API_KEY=<your key>` to `.dev.vars` so `npm run preview` (`wrangler dev`) can exercise the signup endpoint locally.
- **Sending issues / managing subscribers:** done entirely in the [Buttondown dashboard](https://buttondown.com/) — compose and send there, and it handles unsubscribes automatically.

## Bug reports

This repo is public, so its own Issues tab is directly reachable — the footer's "Report a broken link" link points straight at this repo's `issues/new`. No separate mirror repo or GitHub Actions workflow needed.

- **Abuse:** the issue form has no spam filtering beyond GitHub's own account-level protections — anyone with a GitHub account can open an issue here. Acceptable for a low-traffic community site; revisit if that changes.

Content editors and other collaborators still need to be added to this repo (Settings → Collaborators) to get write access — see "Editing content" above.

## Content notes

- **Events** are automatically sorted into "Upcoming" and "Past" based on the event's `date` (or `endDate`, for multi-day events) compared to the time of the most recent build. Since this is a static site, "today" only updates when the site rebuilds — pushing any commit (or editing content through `/admin`) triggers a rebuild.
- The **Gallery** shows an original placeholder illustration until the first community photo is added. Resident photos follow the [Photo Policy](src/pages/site-info/photo-policy.astro) and are stored in R2, not git — see "Gallery photo storage" below.

## Gallery photo storage (R2)

Resident gallery photos never go into this (public) repo. Editors add and delete them at **`/admin/gallery`** (same GitHub login as `/admin`; requires write access to the repo):

- The page resizes the photo in the browser and re-encodes it as JPEG, which drops EXIF/GPS metadata. `functions/api/gallery/index.js` rejects any JPEG that still has an EXIF/XMP/IPTC segment, stores the full image and a thumbnail in the R2 bucket under `gallery/`, and commits a metadata-only entry (`src/content/gallery/<id>.md`: caption, `photo` id, dimensions, `added`, `consent: true`) to `main` as the signed-in editor.
- Photos are served by `functions/api/gallery/[key].js` at `/api/gallery/<id>.jpg` and `/api/gallery/<id>-thumb.jpg`.
- **Takedowns:** the Delete button removes both images from R2 immediately, then deletes the entry. The CMS can edit captions but can't create or delete gallery entries, so takedowns always go through this page.
- The content schema rejects any resident gallery entry without an R2 `photo` id, dimensions, `added`, and `consent: true`. Only site-owned illustrations (local `image`) may set `permanent: true`.

**Retention (12 months, set in `src/lib/gallery-retention.js`)** is enforced at every layer:

1. The R2 bucket's lifecycle rule deletes objects under `gallery/` 365 days after upload.
2. The photo endpoint refuses, and deletes, any object older than the window, in case the rule is missing.
3. The gallery page and search index hide entries past the window at build time.
4. The **Gallery retention** GitHub Action (`.github/workflows/gallery-retention.yml`) runs monthly and deletes expired entries from `main`.

**One-time setup:**

1. Create the bucket (name must match `bucket_name` in `wrangler.jsonc`): `npx wrangler r2 bucket create bentgrass-gallery-photos`
2. Add the lifecycle rule: `npx wrangler r2 bucket lifecycle add bentgrass-gallery-photos gallery-retention gallery/ --expire-days 365`
3. Deploy — the `GALLERY` binding in `wrangler.jsonc` connects the Worker to the bucket. The bucket stays private (no public access or `r2.dev` URL needed).

For local testing, `npm run preview` (`wrangler dev`) uses a local, simulated bucket.
- The **FAQ** and **General Resources** pages are grouped by a `category` field — see `src/content.config.ts` for the fixed set of category values each collection accepts.
