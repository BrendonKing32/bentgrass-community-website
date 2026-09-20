// Cloudflare Pages Function: returns published community gallery records only.
// Requires RESIDENT_DB.

import { json } from "./_shared.js";

export async function onRequestGet({ env }) {
  if (!env.RESIDENT_DB) return json({ photos: [] });
  const rows = await env.RESIDENT_DB.prepare(
    `SELECT id, title, category, credit
     FROM photo_submissions WHERE status = 'published' ORDER BY published_at DESC`
  ).all();
  return json({ photos: rows.results });
}
