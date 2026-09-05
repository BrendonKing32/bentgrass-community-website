// Cloudflare Pages Function: handles newsletter signups by creating a
// subscriber directly through Buttondown's API. Requires the
// BUTTONDOWN_API_KEY secret (see README "Newsletter").

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

  if (!env.BUTTONDOWN_API_KEY) {
    return redirectTo(redirectBase, "error");
  }

  const response = await fetch("https://api.buttondown.com/v1/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
      // Treat re-subscribing an already-known address as a no-op success
      // instead of the 400 Buttondown returns for a plain duplicate.
      "X-Buttondown-Collision-Behavior": "add",
    },
    body: JSON.stringify({ email_address: email }),
  });

  if (!response.ok) {
    return redirectTo(redirectBase, "invalid");
  }

  return redirectTo(redirectBase, "success");
}
