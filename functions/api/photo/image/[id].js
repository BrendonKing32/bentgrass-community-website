// Cloudflare Pages Function: serves a published gallery image from public storage.
// Requires RESIDENT_DB and PHOTO_PUBLIC.

export async function onRequestGet({ params, env }) {
  if (!env.RESIDENT_DB || !env.PHOTO_PUBLIC || !params.id) return new Response("Not found.", { status: 404 });
  const record = await env.RESIDENT_DB.prepare(
    "SELECT object_key, content_type FROM photo_submissions WHERE id = ? AND status = 'published'"
  ).bind(params.id).first();
  if (!record) return new Response("Not found.", { status: 404 });
  const object = await env.PHOTO_PUBLIC.get(record.object_key);
  if (!object) return new Response("Not found.", { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=3600" });
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", record.content_type);
  return new Response(object.body, { headers });
}
