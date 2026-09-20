// Cloudflare Pages Function: consumes a single-use resident magic link.
// Requires RESIDENT_DB.

import { cookieValue, json, randomToken, sessionCookie, sha256 } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  if (!env.RESIDENT_DB) return new Response("Resident directory is not configured.", { status: 503 });
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Missing sign-in token.", { status: 400 });

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const record = await env.RESIDENT_DB.prepare(
    `SELECT resident_id FROM magic_link_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
  ).bind(tokenHash, now).first();
  if (!record) return new Response("This sign-in link is invalid or expired.", { status: 400 });

  await env.RESIDENT_DB.prepare("UPDATE magic_link_tokens SET used_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash).run();

  const sessionToken = randomToken();
  await env.RESIDENT_DB.prepare(
    "INSERT INTO resident_sessions (session_hash, resident_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).bind(await sha256(sessionToken), record.resident_id, new Date(Date.now() + 14 * 86400000).toISOString(), now).run();

  return Response.redirect(new URL("/resident-directory?authenticated=1", request.url).toString(), 303, {
    "Set-Cookie": sessionCookie(sessionToken),
  });
}
