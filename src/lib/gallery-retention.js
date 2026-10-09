// Shared by the gallery page (build time), the photo endpoints in functions/api/gallery/, and
// scripts/gallery-retention.mjs (scheduled cleanup), so the retention window in the published Photo Policy only has to change in one place.

/** How long a resident photo stays in the Community Gallery after it's added. */
export const GALLERY_RETENTION_MONTHS = 12;

/**
 * The date a gallery photo stops being shown and becomes eligible for deletion.
 * @param {Date} added
 * @returns {Date}
 */
export function galleryExpiry(added) {
  const expiry = new Date(added);
  expiry.setMonth(expiry.getMonth() + GALLERY_RETENTION_MONTHS);
  return expiry;
}

/**
 * @param {{ added?: Date; permanent?: boolean }} photo
 * @param {Date} [now]
 */
export function isGalleryPhotoExpired(photo, now = new Date()) {
  if (photo.permanent || !photo.added) return false;
  return galleryExpiry(photo.added) <= now;
}

/** Where gallery photos live in the R2 bucket; the bucket's lifecycle rule targets this prefix. */
export const GALLERY_PREFIX = "gallery/";

/** Object names the photo endpoint will serve: `<id>.jpg` or `<id>-thumb.jpg`. */
export function isGalleryKey(key) {
  return /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,70}\.jpg$/.test(key);
}

/** @param {Date} uploaded */
export function isPastRetention(uploaded, now = new Date()) {
  return galleryExpiry(uploaded) <= now;
}
