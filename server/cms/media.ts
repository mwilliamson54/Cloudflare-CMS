import { TRPCError } from "@trpc/server";
import { createMediaRecord } from "../db";
import { storagePut } from "../storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export async function persistMediaUpload(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  altText?: string | null;
  title?: string | null;
  uploadedById: number;
}) {
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, WebP, GIF, and PDF files are supported." });
  }
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Files must be between 1 byte and 10 MB." });
  }
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180) || "upload";
  const stored = await storagePut(`cms-media/${input.uploadedById}/${safeName}`, bytes, input.mimeType);
  return createMediaRecord({
    storageKey: stored.key,
    url: stored.url,
    fileName: safeName,
    mimeType: input.mimeType,
    sizeBytes: bytes.length,
    altText: input.altText ?? null,
    title: input.title ?? null,
    uploadedById: input.uploadedById,
  });
}
