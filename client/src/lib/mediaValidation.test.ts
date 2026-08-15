import { describe, expect, it } from "vitest";
import { MAX_MEDIA_BYTES, validateMediaFile } from "./mediaValidation";

describe("media client-side validation", () => {
  it("accepts the complete server-supported media MIME allowlist", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "application/pdf"]) {
      expect(validateMediaFile({ type, size: MAX_MEDIA_BYTES })).toBeNull();
    }
  });

  it("rejects unsupported types and files exceeding the client-side size limit", () => {
    expect(validateMediaFile({ type: "text/plain", size: 12 })).toBe("Only JPEG, PNG, WebP, AVIF, GIF, and PDF files are allowed.");
    expect(validateMediaFile({ type: "image/png", size: MAX_MEDIA_BYTES + 1 })).toBe("Files must be 10 MB or smaller.");
  });
});
