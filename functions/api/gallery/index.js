// Cloudflare Pages Function: adds and removes Community Gallery photos for /admin/gallery.
//   POST   /api/gallery           multipart form → stores the photo in R2, commits its entry to the repo
//   DELETE /api/gallery?id=<id>   removes the photo from R2 and deletes its entry from the repo
// Requires the GALLERY R2 bucket binding (see wrangler.jsonc and README "Gallery photo storage").
// Callers authenticate with the same GitHub token the content admin uses (Authorization: Bearer
// <token>) and must have write access to GITHUB_REPO. Commits are made as that editor.

import { GALLERY_PREFIX } from "../../../src/lib/gallery-retention.js";

const GITHUB_REPO = "BrendonKing32/bentgrass-community-website";
const BRANCH = "main";
const ENTRY_DIR = "src/content/gallery";
const CATEGORIES = ["events", "critters", "weather", "neighborhood"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;
const ID_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function github(token, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "bentgrass-community-website",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

/** Returns the caller's token if it has push access to the repo, otherwise null. */
async function authorize(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const res = await github(token, `/repos/${GITHUB_REPO}`);
  if (!res.ok) return null;
  const repo = await res.json();
  return repo.permissions?.push ? token : null;
}

/** True if the bytes are a JPEG with no EXIF/XMP (APP1) segment — i.e. location data was stripped. */
function isCleanJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) return true; // start of image data; no metadata segments before it
    if (marker === 0xe1 || marker === 0xed) return false; // APP1 (EXIF/XMP) or APP13 (IPTC)
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return false;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function onRequestPost({ request, env }) {
  if (!env.GALLERY) return json({ error: "Photo storage isn't configured (missing GALLERY binding)." }, 500);
  const token = await authorize(request);
  if (!token) return json({ error: "Sign in with a GitHub account that can edit this site." }, 401);

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const category = String(form.get("category") || "");
  const credit = String(form.get("credit") || "").trim();
  const taken = String(form.get("date") || "");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const photo = form.get("photo");
  const thumb = form.get("thumb");

  if (form.get("consent") !== "yes") {
    return json({ error: "Confirm the submitter agreed to the Photo Policy." }, 400);
  }
  if (!title || title.length > 200) return json({ error: "Add a caption (up to 200 characters)." }, 400);
  if (!CATEGORIES.includes(category)) return json({ error: "Pick a category." }, 400);
  if (credit.length > 40) return json({ error: "Credit should be a first name or initials." }, 400);
  if (taken && !/^\d{4}-\d{2}-\d{2}$/.test(taken)) return json({ error: "Invalid date taken." }, 400);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return json({ error: "Missing image dimensions." }, 400);
  }
  if (!(photo instanceof File) || !(thumb instanceof File)) return json({ error: "Missing photo." }, 400);
  if (photo.size > MAX_PHOTO_BYTES || thumb.size > MAX_THUMB_BYTES) {
    return json({ error: "Photo is too large." }, 400);
  }

  const photoBytes = new Uint8Array(await photo.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
  if (!isCleanJpeg(photoBytes) || !isCleanJpeg(thumbBytes)) {
    return json({ error: "Photo must be a JPEG with location/camera data removed." }, 400);
  }

  const now = new Date();
  const id = `${now.toISOString().slice(0, 10)}-${slugify(title)}-${crypto.randomUUID().slice(0, 6)}`;
  const httpMetadata = { contentType: "image/jpeg" };
  await env.GALLERY.put(`${GALLERY_PREFIX}${id}.jpg`, photoBytes, { httpMetadata });
  await env.GALLERY.put(`${GALLERY_PREFIX}${id}-thumb.jpg`, thumbBytes, { httpMetadata });

  const lines = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `photo: ${JSON.stringify(id)}`,
    `width: ${width}`,
    `height: ${height}`,
    `category: ${JSON.stringify(category)}`,
    ...(taken ? [`date: ${taken}`] : []),
    ...(credit ? [`credit: ${JSON.stringify(credit)}`] : []),
    `added: ${now.toISOString()}`,
    "consent: true",
    "---",
    "",
  ];
  const commit = await github(token, `/repos/${GITHUB_REPO}/contents/${ENTRY_DIR}/${id}.md`, {
    method: "PUT",
    body: JSON.stringify({ message: `Add gallery photo "${title}"`, content: toBase64(lines.join("\n")), branch: BRANCH }),
  });
  if (!commit.ok) {
    await env.GALLERY.delete([`${GALLERY_PREFIX}${id}.jpg`, `${GALLERY_PREFIX}${id}-thumb.jpg`]);
    return json({ error: `Couldn't save the gallery entry (GitHub ${commit.status}).` }, 502);
  }

  return json({ id });
}

export async function onRequestDelete({ request, env }) {
  if (!env.GALLERY) return json({ error: "Photo storage isn't configured (missing GALLERY binding)." }, 500);
  const token = await authorize(request);
  if (!token) return json({ error: "Sign in with a GitHub account that can edit this site." }, 401);

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "Invalid photo id." }, 400);

  // Delete the photo first: a takedown should remove the image even if the repo update fails.
  await env.GALLERY.delete([`${GALLERY_PREFIX}${id}.jpg`, `${GALLERY_PREFIX}${id}-thumb.jpg`]);

  const path = `/repos/${GITHUB_REPO}/contents/${ENTRY_DIR}/${id}.md`;
  const existing = await github(token, `${path}?ref=${BRANCH}`);
  if (existing.status === 404) return json({ id });
  if (!existing.ok) return json({ error: `Photo removed, but couldn't find its entry (GitHub ${existing.status}).` }, 502);
  const { sha } = await existing.json();
  const removed = await github(token, path, {
    method: "DELETE",
    body: JSON.stringify({ message: `Remove gallery photo ${id}`, sha, branch: BRANCH }),
  });
  if (!removed.ok) return json({ error: `Photo removed, but couldn't delete its entry (GitHub ${removed.status}).` }, 502);

  return json({ id });
}
