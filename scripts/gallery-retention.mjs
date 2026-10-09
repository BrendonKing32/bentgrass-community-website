// Enforces the Photo Policy's retention window on the repo side: deletes gallery entries
// (src/content/gallery/*.md) whose photo is past retention. The photos themselves live in R2 and
// are deleted by the bucket's lifecycle rule (and refused by functions/api/gallery/[key].js).
// Run monthly by .github/workflows/gallery-retention.yml; pass --dry-run to only report.
import { readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { isGalleryPhotoExpired, galleryExpiry } from '../src/lib/gallery-retention.js';

const GALLERY_DIR = path.resolve('src/content/gallery');
const dryRun = process.argv.includes('--dry-run');

for (const name of await readdir(GALLERY_DIR)) {
  if (!name.endsWith('.md')) continue;
  const file = path.join(GALLERY_DIR, name);
  const source = await readFile(file, 'utf8');
  const added = source.match(/^added:\s*["']?([^"'\r\n]+)/m)?.[1];
  const permanent = /^permanent:\s*true\s*$/m.test(source);
  const photo = { added: added ? new Date(added) : undefined, permanent };
  if (!isGalleryPhotoExpired(photo)) continue;
  console.log(`Expired (past ${galleryExpiry(photo.added).toISOString().slice(0, 10)}): ${path.relative('.', file)}`);
  if (!dryRun) await unlink(file);
}
