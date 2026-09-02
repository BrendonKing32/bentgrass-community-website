// Cloudflare Pages Function: handles newsletter signups, storing subscribers
// in the D1 database bound as `DB` (see wrangler.jsonc).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectTo(base, status) {
  const url = new URL(base);
  url.searchParams.set("subscribed", status);
  return Response.redirect(url.toString(), 303);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const form = await request.formData();

  const redirectBase = (() => {
    const target = form.get("redirect");
    if (typeof target === "string" && target.startsWith("/")) {
      return new URL(target, url.origin);
    }
    return new URL("/community-resources/monthly-newsletters", url.origin);
  })();

  // Honeypot: real visitors never fill this hidden field in.
  const honeypot = form.get("company");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return redirectTo(redirectBase, "success");
  }

  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return redirectTo(redirectBase, "invalid");
  }

  const token = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO subscribers (email, unsubscribe_token)
     VALUES (?1, ?2)
     ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL`
  )
    .bind(email, token)
    .run();

  return redirectTo(redirectBase, "success");
}
