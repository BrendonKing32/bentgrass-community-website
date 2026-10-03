// Cloudflare Pages Function: handles newsletter signups by creating a
// subscriber directly through Buttondown's API. Requires the
// BUTTONDOWN_API_KEY secret (see README "Newsletter"). If TURNSTILE_SECRET_KEY
// is set, a Cloudflare Turnstile token is verified before anything else.

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
      const candidate = new URL(target, url.origin);
      if (candidate.origin === url.origin) {
        return candidate;
      }
    }
    return new URL("/community-resources/monthly-newsletters", url.origin);
  })();

  // Honeypot: real visitors never fill this hidden field in.
  const honeypot = form.get("company");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return redirectTo(redirectBase, "success");
  }

  const token = form.get("cf-turnstile-response");
  if (env.TURNSTILE_SECRET_KEY) {
    const verification = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: typeof token === "string" ? token : "",
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      },
    )
      .then((r) => r.json())
      .catch(() => null);
    if (!verification?.success) {
      return redirectTo(redirectBase, "blocked");
    }
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

  // Forward the visitor's real IP so Buttondown's spam firewall scores them
  // instead of Cloudflare's shared Worker egress IP (which reads as a
  // datacenter/proxy address and gets blocked as "subscriber_blocked").
  const visitorIp = request.headers.get("CF-Connecting-IP");

  const response = await fetch("https://api.buttondown.com/v1/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
      // Treat re-subscribing an already-known address as a no-op success
      // instead of the 400 Buttondown returns for a plain duplicate.
      "X-Buttondown-Collision-Behavior": "add",
    },
    body: JSON.stringify({
      email_address: email,
      ...(visitorIp ? { ip_address: visitorIp } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (body?.code === "subscriber_blocked") {
      return redirectTo(redirectBase, "blocked");
    }
    return redirectTo(redirectBase, "invalid");
  }

  return redirectTo(redirectBase, "success");
}
