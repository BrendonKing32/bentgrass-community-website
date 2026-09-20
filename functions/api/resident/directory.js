// Cloudflare Pages Function: returns the approved private resident directory.
// Requires RESIDENT_DB.

import { json, requireResident } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireResident(request, env);
  if (auth.error) return auth.error;
  const rows = await env.RESIDENT_DB.prepare(
    `SELECT id, first_name, last_name, misc,
      CASE WHEN show_email = 1 THEN email ELSE NULL END AS email,
      CASE WHEN show_phone = 1 THEN phone ELSE NULL END AS phone
     FROM residents WHERE status = 'approved'
     ORDER BY last_name, first_name`
  ).all();
  return json({ residents: rows.results });
}
