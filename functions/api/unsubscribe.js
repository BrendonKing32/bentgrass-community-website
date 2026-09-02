// Cloudflare Pages Function: unsubscribes a newsletter subscriber by their
// unique token (included in every issue's unsubscribe link).

function page({ title, message }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} · Bent Grass Neighborhood</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f2f7ee; color: #142010; margin: 0; }
      main { max-width: 32rem; margin: 4rem auto; padding: 2rem; background: #fff; border: 1px solid #c4dab3; border-radius: 1rem; text-align: center; }
      h1 { color: #283c22; font-size: 1.5rem; margin-top: 0; }
      a { color: #38592b; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a href="/">Back to the Bent Grass Neighborhood site</a></p>
    </main>
  </body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(page({ title: "Missing link", message: "This unsubscribe link is missing its token." }), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const result = await env.DB.prepare(
    `UPDATE subscribers SET unsubscribed_at = datetime('now')
     WHERE unsubscribe_token = ?1 AND unsubscribed_at IS NULL`
  )
    .bind(token)
    .run();

  const changed = result.meta?.changes ?? 0;

  return new Response(
    page(
      changed > 0
        ? { title: "You're unsubscribed", message: "You won't receive any more Bent Grass Neighbors newsletter emails. Sorry to see you go!" }
        : { title: "Already unsubscribed", message: "This address is already off the newsletter list — no further action needed." }
    ),
    { headers: { "Content-Type": "text/html" } }
  );
}
