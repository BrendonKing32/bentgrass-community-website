// Cloudflare Pages Function: exports the active newsletter subscriber list
// as CSV, for pasting into whatever tool is used to actually send an issue
// (e.g. BCC in an email client, or a transactional email API).
//
// Protected by the NEWSLETTER_ADMIN_TOKEN secret — set it with:
//   npx wrangler secret put NEWSLETTER_ADMIN_TOKEN
// then visit /api/subscribers?token=<that value>

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!env.NEWSLETTER_ADMIN_TOKEN) {
    return new Response("Missing NEWSLETTER_ADMIN_TOKEN environment variable.", { status: 500 });
  }

  if (!token || token !== env.NEWSLETTER_ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { results } = await env.DB.prepare(
    `SELECT email, subscribed_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at ASC`
  ).all();

  const rows = ["email,subscribed_at", ...results.map((r) => `${csvEscape(r.email)},${csvEscape(r.subscribed_at)}`)];

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bent-grass-newsletter-subscribers.csv"',
    },
  });
}
