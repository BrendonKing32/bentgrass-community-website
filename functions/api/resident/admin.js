// Cloudflare Pages Function: lets approved GitHub repository administrators review resident applications.
// Requires RESIDENT_DB and RESIDENT_ADMIN_GITHUB_LOGINS (comma-separated GitHub usernames).

import { json, text } from "./_shared.js";

async function adminUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !env.RESIDENT_ADMIN_GITHUB_LOGINS) return null;

  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "bentgrass-resident-directory" },
  });
  if (!response.ok) return null;
  const user = await response.json();
  const allowed = env.RESIDENT_ADMIN_GITHUB_LOGINS.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(user.login || "").toLowerCase()) ? user.login : null;
}

export async function onRequestGet({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Resident directory is not configured." }, 503);
  const actor = await adminUser(request, env);
  if (!actor) return json({ error: "Administrator authentication required." }, 403);
  const rows = await env.RESIDENT_DB.prepare(
    `SELECT id, first_name, last_name, address, email, phone, misc, status, submitted_at, reviewed_at, review_note
     FROM resident_applications ORDER BY submitted_at DESC`
  ).all();
  return json({ applications: rows.results });
}

export async function onRequestPost({ request, env }) {
  if (!env.RESIDENT_DB) return json({ error: "Resident directory is not configured." }, 503);
  const actor = await adminUser(request, env);
  if (!actor) return json({ error: "Administrator authentication required." }, 403);
  const form = await request.formData();
  const applicationId = text(form.get("applicationId"), 80);
  const action = text(form.get("action"), 20);
  const note = text(form.get("note"), 500);
  if (!applicationId || !["approve", "reject", "revoke"].includes(action)) {
    return json({ error: "A valid application and action are required." }, 400);
  }

  const application = await env.RESIDENT_DB.prepare("SELECT * FROM resident_applications WHERE id = ?")
    .bind(applicationId).first();
  if (!application) return json({ error: "Application not found." }, 404);

  const now = new Date().toISOString();
  if (action === "approve") {
    if (application.status !== "pending") {
      return json({ error: "Only pending applications can be approved." }, 409);
    }
    const residentId = crypto.randomUUID();
    await env.RESIDENT_DB.prepare(
      `INSERT INTO residents
        (id, application_id, first_name, last_name, address, email, phone, misc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(residentId, application.id, application.first_name, application.last_name, application.address, application.email, application.phone, application.misc, now, now).run();
    await env.RESIDENT_DB.prepare(
      "UPDATE resident_applications SET status = 'approved', reviewed_at = ?, reviewed_by = ?, review_note = ? WHERE id = ?"
    ).bind(now, actor, note, applicationId).run();
    await env.RESIDENT_DB.prepare(
      "INSERT INTO resident_audit_log (id, resident_id, application_id, actor, action, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), residentId, applicationId, actor, "approved", now).run();
  } else {
    if (action === "revoke" && application.status !== "approved") {
      return json({ error: "Only approved applications can be revoked." }, 409);
    }
    if (action === "reject" && application.status !== "pending") {
      return json({ error: "Only pending applications can be rejected." }, 409);
    }
    const status = action === "revoke" ? "revoked" : "rejected";
    await env.RESIDENT_DB.prepare(
      "UPDATE resident_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, review_note = ? WHERE id = ?"
    ).bind(status, now, actor, note, applicationId).run();
    await env.RESIDENT_DB.prepare(
      "UPDATE residents SET status = 'revoked', updated_at = ? WHERE application_id = ?"
    ).bind(now, applicationId).run();
    await env.RESIDENT_DB.prepare(
      "INSERT INTO resident_audit_log (id, application_id, actor, action, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), applicationId, actor, status, now).run();
  }
  return json({ updated: true });
}
