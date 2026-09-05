---
name: cloudflare-pages-functions
description: 'Write or modify server-side API endpoints in functions/api/. Use when adding a new /api/* route, handling secrets/env vars for the Worker, or debugging why an endpoint only works with `npm run preview` and not `npm run dev`.'
---

# Cloudflare Pages Functions

`functions/api/*.js` are [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/), compiled into the Worker at build time (`wrangler pages functions build`, run as part of `npm run build`). They are plain Worker handlers, not Node/Express routes.

## When to Use

- Adding a new `/api/*` endpoint
- Modifying `functions/api/auth.js`, `callback.js`, or `subscribe.js`
- An endpoint works when deployed but returns 404/nothing locally

## Conventions

- **File → route**: `functions/api/<name>.js` is served at `/api/<name>`.
- **Handler exports**: one exported function per HTTP method — `onRequestGet`, `onRequestPost`, etc. — with signature `({ request, env })` (see [functions/api/subscribe.js](../../../functions/api/subscribe.js)).
- **File header comment**: start each file with a short comment stating its purpose and which env vars/secrets it requires (see [functions/api/auth.js](../../../functions/api/auth.js)).
- **Secrets**: read via `env.VAR_NAME`. New secrets need a line in [README.md](../../../README.md), `npx wrangler secret put NAME` for production, and an entry in `.dev.vars` for local `npm run preview`.
- **Validate before calling external APIs**: guard/sanitize input and return early with a `Response`/`Response.redirect` on failure rather than letting exceptions propagate (see the honeypot + email-regex checks in [functions/api/subscribe.js](../../../functions/api/subscribe.js)).
- **Errors**: return a `Response` with an appropriate status code and a plain-text or redirect body; don't throw uncaught errors.

## Local Testing

`npm run dev` only runs the Astro dev server — it does **not** load `functions/api/`. Use `npm run preview` (runs the full Worker via `wrangler dev`) to exercise these endpoints locally.

## Related

- README "Setting up the content admin (GitHub OAuth)" and "Newsletter (Buttondown)" for the operational side (creating OAuth apps, API keys, setting secrets).
- [AGENTS.md](../../../AGENTS.md) / [CLAUDE.md](../../../CLAUDE.md) for the rest of the project's conventions.
