// Cloudflare Pages Function: completes the GitHub OAuth flow for the content
// admin (Sveltia CMS). Exchanges the ?code= for an access token and hands it
// back to the CMS popup window via postMessage, following Decap's github
// backend protocol (which Sveltia CMS also implements for compatibility).

function renderScript(message) {
  return `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        const opener = window.opener;
        if (!opener) return;

        function receiveMessage(e) {
          if (e.origin !== window.location.origin || e.source !== opener) return;
          opener.postMessage(${JSON.stringify(message)}, window.location.origin);
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        opener.postMessage("authorizing:github", window.location.origin);
      })();
    </script>
  </body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("decap_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return new Response("Invalid or missing OAuth state.", { status: 400 });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error || !tokenData.access_token) {
    return new Response(`GitHub OAuth error: ${tokenData.error_description || tokenData.error || "unknown error"}`, {
      status: 400,
    });
  }

  const message = `authorization:github:success:${JSON.stringify({
    token: tokenData.access_token,
    provider: "github",
  })}`;

  return new Response(renderScript(message), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": "decap_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
