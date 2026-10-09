// Cloudflare Pages Function: serves Community Gallery photos from R2 at /api/gallery/<key>.
// Requires the GALLERY R2 bucket binding (see wrangler.jsonc and README "Gallery photo storage").
//
// The bucket's lifecycle rule deletes photos after the retention window; this also refuses (and
// deletes) anything older than that, so retention holds even if the lifecycle rule is missing.

import { GALLERY_PREFIX, isGalleryKey, isPastRetention } from "../../../src/lib/gallery-retention.js";

export async function onRequestGet({ params, env }) {
  const key = String(params.key);
  if (!env.GALLERY || !isGalleryKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.GALLERY.get(GALLERY_PREFIX + key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  if (isPastRetention(object.uploaded)) {
    await env.GALLERY.delete(GALLERY_PREFIX + key);
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/jpeg",
      // Short cache so takedowns take effect quickly.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
}
