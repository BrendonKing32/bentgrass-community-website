// Cloudflare Pages Function: accepts and screens a verified resident photo submission.
// Requires RESIDENT_DB, PHOTO_QUARANTINE, IMAGE_SAFETY_API_URL, and IMAGE_SAFETY_API_TOKEN.

import { ALLOWED_TYPES, CATEGORIES, MAX_BYTES, json, requireResident, screenImage, stripMetadata, text } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireResident(request, env);
  if (auth.error) return auth.error;
  if (!env.PHOTO_QUARANTINE) return json({ error: "Photo submissions are not configured." }, 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);

  const form = await request.formData();
  const file = form.get("photo");
  const title = text(form.get("title"), 120);
  const category = text(form.get("category"), 30);
  const credit = text(form.get("credit"), 120);
  const confirmsRights = form.get("confirmsRights") === "on";
  const confirmsPrivacy = form.get("confirmsPrivacy") === "on";
  const noRecognizableMinors = form.get("noRecognizableMinors") === "on";

  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type)) {
    return json({ error: "Use a JPEG, PNG, or WebP image no larger than 10 MB." }, 400);
  }
  if (!title || !category || !CATEGORIES.has(category) || !confirmsRights || !confirmsPrivacy || !noRecognizableMinors) {
    return json({ error: "Complete the title, category, and all rights and privacy confirmations." }, 400);
  }

  const original = await file.arrayBuffer();
  const sanitized = stripMetadata(original, file.type);
  if (!sanitized) return json({ error: "This image could not be safely processed." }, 400);
  const screening = await screenImage(env, sanitized, file.type);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let objectKey = null;

  if (screening.status !== "high_risk") {
    objectKey = `quarantine/${id}`;
    await env.PHOTO_QUARANTINE.put(objectKey, sanitized, {
      httpMetadata: { contentType: file.type, cacheControl: "no-store" },
      customMetadata: { submissionId: id },
    });
  }

  await env.RESIDENT_DB.prepare(
    `INSERT INTO photo_submissions
      (id, resident_id, title, category, credit, content_type, object_key, status, provider_verdict, provider_reference, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, auth.resident.id, title, category, credit, file.type, objectKey, screening.status, screening.verdict, screening.reference, now).run();

  return json({
    submitted: true,
    status: screening.status === "cleared" ? "cleared_pending_publication" : "received",
  }, 201);
}
