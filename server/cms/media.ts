import { TRPCError } from "@trpc/server";
import { createMediaRecord, getMediaRecord, updateMediaRecord } from "../db";
import { s3CompatibleMediaStorage } from "./mediaStorage";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "application/pdf"]);

export function mediaKey(fileName: string, uploadedById: number, now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/u${uploadedById}/${fileName}`;
}

function extFor(mimeType: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif", "application/pdf": "pdf" }[mimeType];
}

export async function persistMediaUpload(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  altText?: string | null;
  title?: string | null;
  uploadedById: number;
}) {
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, WebP, AVIF, GIF, and PDF files are supported." });
  }
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Files must be between 1 byte and 10 MB." });
  }
  const safeStem = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 160) || "upload";
  const expectedExtension = extFor(input.mimeType);
  if (!expectedExtension) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported upload type." });
  const safeName = `${safeStem}.${expectedExtension}`;
  const stored = await s3CompatibleMediaStorage.put({ key: mediaKey(safeName, input.uploadedById), bytes, mimeType: input.mimeType });
  return createMediaRecord({
    storageKey: stored.key,
    storageProvider: stored.provider,
    url: stored.url,
    fileName: safeName,
    originalFileName: input.fileName.slice(0, 255),
    mimeType: input.mimeType,
    sizeBytes: bytes.length,
    altText: input.altText ?? null,
    title: input.title ?? null,
    uploadedById: input.uploadedById,
  });
}

/** Replaces file bytes while preserving the media row ID used by content references. */
export async function persistMediaReplacement(input: {
  mediaId: number;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  uploadedById: number;
}) {
  const existing = await getMediaRecord(input.mediaId);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Media record not found." });
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, WebP, AVIF, GIF, and PDF files are supported." });
  }
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Files must be between 1 byte and 10 MB." });
  }
  const safeStem = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 160) || "upload";
  const extension = extFor(input.mimeType);
  if (!extension) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported upload type." });
  const fileName = `${safeStem}.${extension}`;
  const stored = await s3CompatibleMediaStorage.put({ key: mediaKey(fileName, input.uploadedById), bytes, mimeType: input.mimeType });
  return updateMediaRecord(input.mediaId, {
    storageKey: stored.key,
    storageProvider: stored.provider,
    url: stored.url,
    fileName,
    originalFileName: input.fileName.slice(0, 255),
    mimeType: input.mimeType,
    sizeBytes: bytes.length,
  });
}
