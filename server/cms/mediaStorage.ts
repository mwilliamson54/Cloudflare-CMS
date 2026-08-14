import { storagePut } from "../storage";

export type MediaStoragePutInput = {
  key: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type StoredMediaObject = {
  provider: "s3-compatible" | "cloudflare-r2";
  key: string;
  url: string;
};

export interface MediaStorageProvider {
  put(input: MediaStoragePutInput): Promise<StoredMediaObject>;
}

/**
 * Local/managed-development adapter. The Cloudflare Pages REST adapter uses
 * the same contract but writes directly to the CMS_MEDIA R2 binding.
 */
export const s3CompatibleMediaStorage: MediaStorageProvider = {
  async put(input) {
    const stored = await storagePut(input.key, input.bytes, input.mimeType);
    return { provider: "s3-compatible", key: stored.key, url: stored.url };
  },
};
