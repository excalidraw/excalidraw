import { Storage } from "@google-cloud/storage";

import { env } from "./env.js";

let storage: Storage | undefined;

const getBucket = () => {
  storage ??= new Storage();
  return storage.bucket(env.gcsBucket);
};

export async function uploadObject(path: string, data: Buffer): Promise<void> {
  await getBucket()
    .file(path)
    .save(data, {
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
}

export async function downloadObject(path: string): Promise<Buffer> {
  const [data] = await getBucket().file(path).download();
  return data;
}
