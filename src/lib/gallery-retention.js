// Shared by the gallery page (build time) and scripts/gallery-retention.mjs (scheduled cleanup),
// so the retention window in the published Photo Policy only has to change in one place.

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
