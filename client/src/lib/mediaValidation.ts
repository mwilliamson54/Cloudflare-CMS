export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "application/pdf"]);

export function validateMediaFile(file: Pick<File, "type" | "size">) {
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) return "Only JPEG, PNG, WebP, AVIF, GIF, and PDF files are allowed.";
  if (file.size > MAX_MEDIA_BYTES) return "Files must be 10 MB or smaller.";
  return null;
}
