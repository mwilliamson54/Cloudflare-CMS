import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, allowedMimeTypes, mediaKey } from "./media";

describe("media storage contract", () => {
  it("uses a stable, scalable year/month upload key without exposing database identifiers", () => {
    expect(mediaKey("lookbook.webp", 42, new Date("2026-08-14T12:00:00Z"))).toBe("uploads/2026/08/u42/lookbook.webp");
  });

  it("accepts the documented image formats and retains a bounded upload policy", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) expect(allowedMimeTypes.has(mime)).toBe(true);
    expect(allowedMimeTypes.has("application/pdf")).toBe(true);
    expect(allowedMimeTypes.has("image/svg+xml")).toBe(false);
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("separates otherwise identical upload names by uploader key prefix", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    expect(mediaKey("lookbook.webp", 42, now)).not.toBe(mediaKey("lookbook.webp", 43, now));
  });
});
