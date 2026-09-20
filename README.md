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
  components/      Reusable Astro components (Header, Footer, cards, etc.)
  layouts/         Page shell (BaseLayout)
  pages/           Routes — mostly thin wrappers that query content/ and render it
public/
  admin/           Sveltia CMS admin UI (config.yml + index.html)
functions/api/     GitHub OAuth handlers + the newsletter signup endpoint, written as Pages
                   Functions and compiled into the Worker at build time
migrations/        D1 migrations for private residents and moderated photo submissions
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

**Option B — use the content admin at `/admin`.** Once GitHub OAuth is configured (see below), anyone with access to the GitHub repo can go to `https://www.bentgrassneighborhood.org/admin`, log in with GitHub, and add/edit News, Events, Newsletters, FAQ, Resources, and Gallery photos through a form UI. Saving creates a commit directly on the `main` branch, which triggers a rebuild.

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

**Manual/one-off deploys** (no git push needed): `npm run build && npm run deploy` from your machine, using an authenticated `wrangler` (run `npx wrangler login` once).

## Setting up the content admin (GitHub OAuth)

Sveltia CMS needs a GitHub OAuth App so it can commit on behalf of logged-in editors. This repo already includes the OAuth handlers (`functions/api/auth.js` and `functions/api/callback.js`), compiled into the Worker at build time — you just need to create the OAuth App and set two secrets on the Worker.

The Homepage/callback URLs below, and `base_url` in `public/admin/config.yml`, must all point at whatever origin the site is actually reachable at **right now**. Until the custom domain is wired up, that's the `*.workers.dev` URL, not `www.bentgrassneighborhood.org` — using the wrong one breaks the login popup. Once the custom domain goes live, update both (see "Switching to the custom domain" below).

1. In GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App** (or create it under the organization/account that owns this repo).
   - **Homepage URL:** `https://bentgrass-community-website.brendonking-934.workers.dev`
   - **Authorization callback URL:** `https://bentgrass-community-website.brendonking-934.workers.dev/api/callback`
2. Copy the generated **Client ID** and generate a **Client Secret**.
3. Set them as Worker secrets — either via the dashboard (Worker → **Settings → Variables and Secrets → Add**, type **Secret**) or from the CLI:
   ```sh
   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
   ```
4. Secrets set via the dashboard trigger a redeploy automatically; via Wrangler, `secret put` deploys immediately. Anyone with **write access to the GitHub repo** can now sign in at `/admin` and edit content. (Sveltia's GitHub backend authorizes based on repo permissions — there's no separate user list to manage.)

### Switching to the custom domain

Once `www.bentgrassneighborhood.org` is wired up (see "Deployment" above) and serving the site, admin login needs to move over too:

1. In the GitHub OAuth App's settings, update **Homepage URL** and **Authorization callback URL** to use `https://www.bentgrassneighborhood.org` instead of the `*.workers.dev` URL.
2. In `public/admin/config.yml`, update `base_url` to `https://www.bentgrassneighborhood.org` and remove the `TODO` comment above it, then commit and push.
3. The Client ID/Secret themselves don't change — no need to regenerate or re-run `wrangler secret put`.

The `*.workers.dev` URL keeps working as a fallback for the rest of the site either way, but `/admin` will only work against the one origin currently set in `config.yml`.

## Newsletter (Buttondown)

The "Subscribe to the newsletter" form on the home page and the Monthly Newsletters page posts to `/api/subscribe` (`functions/api/subscribe.js`), which creates the subscriber directly through [Buttondown's API](https://docs.buttondown.com/api-subscribers-create). Buttondown owns the subscriber list, the double opt-in confirmation email, sending issues, and per-subscriber unsubscribe links — this site never sees or stores the list itself.

- **API key:** set the `BUTTONDOWN_API_KEY` secret with `npx wrangler secret put BUTTONDOWN_API_KEY` (a Buttondown API key, from your Buttondown account's API settings). Without it, the signup form redirects with an error.
- **Spam protection:** the signup form has a hidden honeypot field; bots that fill it in get a fake "success" redirect without ever calling Buttondown.
- **Local development:** add `BUTTONDOWN_API_KEY=<your key>` to `.dev.vars` so `npm run preview` (`wrangler dev`) can exercise the signup endpoint locally.
- **Sending issues / managing subscribers:** done entirely in the [Buttondown dashboard](https://buttondown.com/) — compose and send there, and it handles unsubscribes automatically.

## Private resident directory

The resident directory at `/resident-directory` is not a public content collection. It uses the `RESIDENT_DB` Cloudflare D1 binding, server-side session cookies, and one-time email magic links. Applicants submit their name, community address, email, and optional phone/miscellaneous information for manual administrator review. Owners and current renters are eligible.

Directory records are never included in Astro's static output or public search index. Address is used for verification and is not displayed. Email and phone visibility are off by default and can be independently enabled or hidden by the resident.

Before deploying this feature:

1. Create a D1 database and replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc`.
2. Apply migrations with `npx wrangler d1 migrations apply bentgrass-residents --remote`.
3. Configure `RESEND_API_KEY` and `RESIDENT_EMAIL_FROM` for magic-link delivery. The provider adapter currently targets Resend; no sign-in link is sent until both values are configured.
4. Configure `RESIDENT_ADMIN_GITHUB_LOGINS` as a comma-separated list of GitHub usernames allowed to review applications through `/api/resident/admin`. Administrators can use the GitHub token from the CMS session as a bearer token; board oversight should be reflected in this allowlist.
5. Set up the administrator review workflow: `GET /api/resident/admin` lists applications and `POST /api/resident/admin` accepts `applicationId`, `action` (`approve`, `reject`, or `revoke`), and an optional `note`. Do not publish resident data as markdown or expose the D1 binding to client code.

For local preview, add the D1 binding and email values to Wrangler's local configuration, then use `npm run preview`; `npm run dev` does not execute the Worker endpoints.

## Bug reports

This repo is public, so its own Issues tab is directly reachable — the footer's "Report a broken link" link points straight at this repo's `issues/new`. No separate mirror repo or GitHub Actions workflow needed.

- **Abuse:** the issue form has no spam filtering beyond GitHub's own account-level protections — anyone with a GitHub account can open an issue here. Acceptable for a low-traffic community site; revisit if that changes.

Content editors and other collaborators still need to be added to this repo (Settings → Collaborators) to get write access — see "Editing content" above.

## Content notes

- **Events** are automatically sorted into "Upcoming" and "Past" based on the event's `date` (or `endDate`, for multi-day events) compared to the time of the most recent build. Since this is a static site, "today" only updates when the site rebuilds — pushing any commit (or editing content through `/admin`) triggers a rebuild.
- **Gallery** starts empty with a "submit a photo" call to action. Add photos either via `/admin` (uploads go to `public/images/uploads/`) or by adding files directly and committing.
- The **FAQ** and **General Resources** pages are grouped by a `category` field — see `src/content.config.ts` for the fixed set of category values each collection accepts.

## Moderated photo submissions

Verified residents can submit photos at `/community-gallery/submit`. Submissions are accepted only through the authenticated Worker endpoint, have EXIF metadata stripped, and are stored in the private `PHOTO_QUARANTINE` R2 bucket. The image safety adapter calls `IMAGE_SAFETY_API_URL` with `IMAGE_SAFETY_API_TOKEN` and requires a provider response that explicitly supports illegal-content/CSAM handling. Missing configuration, provider errors, and uncertain results fail closed into specialist review.

High-risk results are never stored in the local quarantine bucket and are not shown to administrators. The external provider and the designated security/legal contact must handle escalation according to the provider's trust-and-safety and legal process. Community administrators can only preview explicitly cleared images and publish or reject safe queue items through `/api/photo/admin`.

Production setup requires two private R2 buckets (`bentgrass-photo-quarantine` and `bentgrass-photo-public`), the `0002_photo_submissions.sql` migration, `IMAGE_SAFETY_API_URL`, `IMAGE_SAFETY_API_TOKEN`, and `PHOTO_ADMIN_GITHUB_LOGINS`. Do not configure a generic image classifier as the only CSAM control; select a service with documented hash matching, escalation, retention, and reporting responsibilities before enabling submissions.

The safety endpoint is intentionally provider-neutral. It receives `{ "content_type": "...", "image_base64": "...", "require_csam_workflow": true }` and must return a JSON verdict of `clear`, `high_risk`, `rejected`, or `specialist_review`, plus an optional provider reference. The adapter fails closed for missing configuration, errors, unsupported responses, and timeouts. A practical provider evaluation should start with PhotoDNA Cloud for known-CSAM hash matching and a separate specialist image-safety service for broader illegal/inappropriate content; confirm eligibility, reporting duties, retention, and legal terms with each provider before onboarding.
