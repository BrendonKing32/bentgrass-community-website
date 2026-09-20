// Cloudflare Pages Function: reads and updates the signed-in resident profile.
// Requires RESIDENT_DB.

import { json, requireResident, text } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireResident(request, env);
  if (auth.error) return auth.error;
  const { resident } = auth;
  return json({
    resident: {
      firstName: resident.first_name,
      lastName: resident.last_name,
      email: resident.email,
      phone: resident.phone,
      misc: resident.misc,
      showEmail: Boolean(resident.show_email),
      showPhone: Boolean(resident.show_phone),
    },
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireResident(request, env);
  if (auth.error) return auth.error;
  const { resident } = auth;
  const form = await request.formData();
  const phone = text(form.get("phone"), 40);
  const misc = text(form.get("misc"), 1000);
  const showEmail = form.get("showEmail") === "on";
  const showPhone = form.get("showPhone") === "on";
  await env.RESIDENT_DB.prepare(
    `UPDATE residents SET phone = ?, misc = ?, show_email = ?, show_phone = ?, updated_at = ?
     WHERE id = ?`
  ).bind(phone, misc, showEmail ? 1 : 0, showPhone ? 1 : 0, new Date().toISOString(), resident.id).run();
  return json({ updated: true });
}
