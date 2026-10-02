import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { assertSafeKey } from "./keys";

import type { StorageProvider } from "./index";

export interface S3Options {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey?: string;
  secretKey?: string;
  prefix?: string;
  forcePathStyle?: boolean;
}

/** S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, Ceph…). */
export class S3Storage implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(o: S3Options) {
    this.bucket = o.bucket;
    this.prefix = o.prefix ? `${o.prefix.replace(/^\/+|\/+$/g, "")}/` : "";
    this.client = new S3Client({
      region: o.region,
      endpoint: o.endpoint,
      forcePathStyle: o.forcePathStyle,
      credentials:
        o.accessKey && o.secretKey
          ? { accessKeyId: o.accessKey, secretAccessKey: o.secretKey }
          : undefined,
      // Newer SDKs add CRC checksums by default; many S3-compatible servers reject them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  private key(k: string) {
    return this.prefix + assertSafeKey(k);
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(key),
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string) {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
      );
      const bytes = await res.Body!.transformToByteArray();
      return {
        data: Buffer.from(bytes),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch (e: any) {
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw e;
    }
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
    );
  }

  async deletePrefix(prefix: string) {
    const full = `${this.prefix}${assertSafeKey(prefix.replace(/\/$/, ""))}/`;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: full,
          ContinuationToken: token,
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key) {
          await this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key }),
          );
        }
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  destroy() {
    this.client.destroy();
  }
}
