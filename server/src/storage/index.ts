import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

import type { Config } from "../config";

/**
 * Object storage abstraction for binary scene files (images) and exports.
 * Metadata lives in MongoDB; bytes live behind this interface so production
 * can swap in S3-compatible storage without touching route code.
 */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

export const createStorage = (config: Config): StorageProvider => {
  if (config.storage.provider === "local") {
    return new LocalStorage(config.storage.path);
  }
  const s3 = config.storage.s3;
  if (!s3.bucket) {
    throw new Error(
      "STORAGE_PROVIDER=s3 requires S3_BUCKET (and S3_ACCESS_KEY / S3_SECRET_KEY unless using an instance role).",
    );
  }
  return new S3Storage({ ...s3, bucket: s3.bucket });
};
