// Cloudflare Pages Function: completes the GitHub OAuth flow for Decap CMS.
// Exchanges the ?code= for an access token and hands it back to the CMS
// popup window via postMessage, following Decap's github backend protocol.

function renderScript(message) {
  return `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        function receiveMessage(e) {
          window.opener.postMessage(
            ${JSON.stringify(message)},
            e.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
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
      "Content-Type": "text/html",
      "Set-Cookie": "decap_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
