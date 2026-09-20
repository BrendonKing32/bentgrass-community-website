// Cloudflare Pages Function: provides metadata-only photo moderation and publication actions.
// Requires RESIDENT_DB, PHOTO_QUARANTINE, PHOTO_PUBLIC, and PHOTO_ADMIN_GITHUB_LOGINS.

import { json, text } from "./_shared.js";

async function adminUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !env.PHOTO_ADMIN_GITHUB_LOGINS) return null;
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "bentgrass-photo-moderation" },
  });
  if (!response.ok) return null;
  const user = await response.json();
  const allowed = env.PHOTO_ADMIN_GITHUB_LOGINS.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(user.login || "").toLowerCase()) ? user.login : null;
}

export async function onRequestGet({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Photo moderation is not configured." }, 503);
  const actor = await adminUser(request, env);
  if (!actor) return json({ error: "Administrator authentication required." }, 403);
  const rows = await env.RESIDENT_DB.prepare(
    `SELECT id, title, category, credit, status, provider_verdict, submitted_at, reviewed_at, published_at, rejection_reason
     FROM photo_submissions
     WHERE status IN ('cleared', 'published', 'withdrawn')
     ORDER BY submitted_at DESC`
  ).all();
  return json({ submissions: rows.results.map((row) => ({
    ...row,
    previewUrl: row.status === "cleared" ? `/api/photo/preview/${row.id}` : null,
  })) });
}

export async function onRequestPost({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Photo moderation is not configured." }, 503);
  const actor = await adminUser(request, env);
  if (!actor) return json({ error: "Administrator authentication required." }, 403);
  const form = await request.formData();
  const id = text(form.get("id"), 80);
  const action = text(form.get("action"), 20);
  const reason = text(form.get("reason"), 500);
  if (!id || !["publish", "reject", "withdraw"].includes(action)) return json({ error: "Invalid moderation action." }, 400);
  const row = await env.RESIDENT_DB.prepare("SELECT * FROM photo_submissions WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "Submission not found." }, 404);
  if (["high_risk", "specialist_review"].includes(row.status)) {
    return json({ error: "Submission not found." }, 404);
  }
  const now = new Date().toISOString();

  if (action === "publish") {
    if (row.status !== "cleared" || !row.object_key || !env.PHOTO_QUARANTINE || !env.PHOTO_PUBLIC) {
      return json({ error: "Only cleared submissions can be published." }, 409);
    }
    const object = await env.PHOTO_QUARANTINE.get(row.object_key);
    if (!object) return json({ error: "Quarantine object is unavailable." }, 409);
    const publicKey = `gallery/${row.id}`;
    await env.PHOTO_PUBLIC.put(publicKey, object.body, { httpMetadata: { contentType: row.content_type, cacheControl: "public, max-age=3600" } });
    await env.PHOTO_QUARANTINE.delete(row.object_key);
    await env.RESIDENT_DB.prepare(
      "UPDATE photo_submissions SET status = 'published', object_key = ?, reviewed_at = ?, reviewed_by = ?, published_at = ? WHERE id = ?"
    ).bind(publicKey, now, actor, now, id).run();
  } else if (action === "reject") {
    if (row.object_key && env.PHOTO_QUARANTINE) await env.PHOTO_QUARANTINE.delete(row.object_key);
    await env.RESIDENT_DB.prepare(
      "UPDATE photo_submissions SET status = 'rejected', object_key = NULL, reviewed_at = ?, reviewed_by = ?, rejection_reason = ? WHERE id = ?"
    ).bind(now, actor, reason, id).run();
  } else {
    if (row.status !== "published") return json({ error: "Only published photos can be withdrawn." }, 409);
    if (row.object_key && env.PHOTO_PUBLIC) await env.PHOTO_PUBLIC.delete(row.object_key);
    await env.RESIDENT_DB.prepare(
      "UPDATE photo_submissions SET status = 'withdrawn', reviewed_at = ?, reviewed_by = ?, rejection_reason = ? WHERE id = ?"
    ).bind(now, actor, reason, id).run();
  }
  return json({ updated: true });
}
