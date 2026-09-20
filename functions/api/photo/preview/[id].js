// Cloudflare Pages Function: previews explicitly cleared images for authorized photo administrators.
// Requires RESIDENT_DB, PHOTO_QUARANTINE, and PHOTO_ADMIN_GITHUB_LOGINS.

import { json } from "../_shared.js";

export async function onRequestGet({ request, env, params }) {
  if (!env.RESIDENT_DB) return json({ error: "Photo moderation is not configured." }, 503);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ") || !env.PHOTO_ADMIN_GITHUB_LOGINS) return json({ error: "Administrator authentication required." }, 403);
  const token = authorization.slice(7);
  const response = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "bentgrass-photo-moderation" } });
  if (!response.ok) return json({ error: "Administrator authentication required." }, 403);
  const user = await response.json();
  const allowed = env.PHOTO_ADMIN_GITHUB_LOGINS.split(",").map((name) => name.trim().toLowerCase());
  if (!allowed.includes(String(user.login || "").toLowerCase())) return json({ error: "Administrator authentication required." }, 403);
  const row = await env.RESIDENT_DB.prepare("SELECT object_key, content_type FROM photo_submissions WHERE id = ? AND status = 'cleared'").bind(params.id).first();
  if (!row || !env.PHOTO_QUARANTINE) return new Response("Not found.", { status: 404 });
  const object = await env.PHOTO_QUARANTINE.get(row.object_key);
  if (!object) return new Response("Not found.", { status: 404 });
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": row.content_type });
  return new Response(object.body, { headers });
}
