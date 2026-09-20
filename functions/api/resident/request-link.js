// Cloudflare Pages Function: sends a magic link to an approved resident.
// Requires RESIDENT_DB, RESEND_API_KEY, and RESIDENT_EMAIL_FROM.

import { json, normalizeEmail, randomToken, sendMagicLink, sha256 } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Resident directory is not configured." }, 503);
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!email) return json({ sent: true });

  const resident = await env.RESIDENT_DB.prepare(
    "SELECT id FROM residents WHERE email = ? AND status = 'approved'"
  ).bind(email).first();

  // Keep the response identical whether or not the email is in the directory.
  if (!resident) return json({ sent: true });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.RESIDENT_DB.prepare(
    "INSERT INTO magic_link_tokens (token_hash, resident_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).bind(await sha256(token), resident.id, expiresAt, new Date().toISOString()).run();

  const link = `${new URL(request.url).origin}/api/resident/consume-link?token=${encodeURIComponent(token)}`;
  const sent = await sendMagicLink(env, email, link);
  return json({ sent: true, configured: sent });
}
