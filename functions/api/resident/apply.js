// Cloudflare Pages Function: accepts a private resident-directory application.
// Requires the RESIDENT_DB D1 binding.

import { json, normalizeEmail, text } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Resident directory is not configured." }, 503);
  const form = await request.formData();
  const firstName = text(form.get("firstName"), 80);
  const lastName = text(form.get("lastName"), 80);
  const address = text(form.get("address"), 240);
  const email = normalizeEmail(form.get("email"));
  const phone = text(form.get("phone"), 40);
  const misc = text(form.get("misc"), 1000);

  if (!firstName || !lastName || !address || !email) {
    return json({ error: "First name, last name, address, and a valid email are required." }, 400);
  }

  const id = crypto.randomUUID();
  await env.RESIDENT_DB.prepare(
    `INSERT INTO resident_applications
      (id, first_name, last_name, address, email, phone, misc, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, firstName, lastName, address, email, phone, misc, new Date().toISOString()).run();

  return json({ submitted: true }, 201);
}
