// Cloudflare Pages Function: signs a resident out and revokes the current session.
// Requires RESIDENT_DB.

import { cookieValue, json, sessionCookie, sha256, SESSION_COOKIE } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (env.RESIDENT_DB && token) {
    await env.RESIDENT_DB.prepare("DELETE FROM resident_sessions WHERE session_hash = ?")
      .bind(await sha256(token)).run();
  }
  return json({ loggedOut: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
