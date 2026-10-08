// Enforces the Photo Policy (/site-info/photo-policy) on the files in the repo:
//   1. Deletes gallery entries (and their images) past the retention window.
//   2. Strips EXIF/GPS/XMP/IPTC metadata from the remaining gallery images.
// Run by .github/workflows/gallery-retention.yml; safe to run locally with `node scripts/gallery-retention.mjs`.
// Pass --dry-run to report without changing anything.
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isGalleryPhotoExpired, galleryExpiry } from '../src/lib/gallery-retention.js';

const GALLERY_DIR = path.resolve('src/content/gallery');
const dryRun = process.argv.includes('--dry-run');

/** Minimal frontmatter reader — gallery entries only use flat `key: value` fields. */
function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields = {};
  for (const line of match?.[1].split(/\r?\n/) ?? []) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

const entries = [];
for (const name of await readdir(GALLERY_DIR)) {
  if (!name.endsWith('.md')) continue;
  const file = path.join(GALLERY_DIR, name);
  const fields = frontmatter(await readFile(file, 'utf8'));
  entries.push({
    file,
    image: fields.image ? path.resolve(GALLERY_DIR, fields.image) : null,
    added: fields.added ? new Date(fields.added) : undefined,
    permanent: fields.permanent === 'true',
  });
}

const expired = entries.filter((e) => isGalleryPhotoExpired(e));
const kept = entries.filter((e) => !expired.includes(e));
const keptImages = new Set(kept.map((e) => e.image));

for (const entry of expired) {
  console.log(`Expired (past ${galleryExpiry(entry.added).toISOString().slice(0, 10)}): ${path.relative('.', entry.file)}`);
  if (dryRun) continue;
  await unlink(entry.file);
  if (entry.image && !keptImages.has(entry.image)) await unlink(entry.image).catch(() => {});
}

for (const image of keptImages) {
  if (!image) continue;
  const input = await readFile(image);
  const meta = await sharp(input).metadata();
  if (!meta.exif && !meta.xmp && !meta.iptc) continue;
  console.log(`Stripping metadata: ${path.relative('.', image)}`);
  if (dryRun) continue;
  // rotate() bakes in the EXIF orientation before it's dropped; sharp omits metadata on output by default.
  await writeFile(image, await sharp(input).rotate().toFormat(meta.format).toBuffer());
}
