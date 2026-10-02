import { z } from "zod";

import { HttpError } from "./http";
import { sceneFileKey } from "./repos/scenes";
import {
  buildSceneFields,
  MAX_SCENE_BYTES,
  sceneDataSchema,
  thumbnailSchema,
} from "./sceneData";

import type { FastifyInstance } from "fastify";
import type { ObjectId } from "mongodb";
import type { SceneDoc } from "./db";

/** Shared by authenticated and share-link routes so the write path is identical. */
export const saveBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  elements: sceneDataSchema.shape.elements,
  appState: sceneDataSchema.shape.appState,
  thumbnail: thumbnailSchema.nullable().optional(),
});

export type CommitResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; version: number; data: SceneDoc["data"] };

export const commitSceneData = async (
  app: FastifyInstance,
  sceneId: ObjectId,
  body: z.infer<typeof saveBodySchema>,
  updatedBy: ObjectId,
): Promise<CommitResult> => {
  const { database } = app;
  const fields = buildSceneFields(body);
  if (fields.sizeBytes > MAX_SCENE_BYTES) {
    throw new HttpError(413, "scene_too_large");
  }
  const res = await database.c.scenes.findOneAndUpdate(
    { _id: sceneId, version: body.baseVersion, deletedAt: null },
    {
      $set: {
        ...fields,
        updatedAt: new Date(),
        updatedBy,
        ...(body.thumbnail !== undefined ? { thumbnail: body.thumbnail } : {}),
      },
      $inc: { version: 1 },
    },
    { returnDocument: "after", projection: { version: 1, updatedAt: 1 } },
  );
  if (res) {
    return {
      ok: true,
      version: res.version,
      updatedAt: res.updatedAt.toISOString(),
    };
  }
  const current = await database.c.scenes.findOne({ _id: sceneId });
  if (!current || current.deletedAt) {
    throw new HttpError(404, "not_found", "scene not found");
  }
  return { ok: false, version: current.version, data: current.data };
};

export const ALLOWED_FILE_TYPES: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) =>
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  "image/gif": (b) => b.subarray(0, 3).toString() === "GIF",
  "image/webp": (b) =>
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP",
  "image/svg+xml": (b) =>
    /<svg[\s>]/i.test(b.subarray(0, 2048).toString("utf8")),
};
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const FILE_BODY_LIMIT = Math.ceil(MAX_FILE_BYTES * 1.4);
export const FILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const fileBody = z.object({
  mimeType: z.string(),
  dataBase64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export const storeSceneFile = async (
  app: FastifyInstance,
  sceneId: ObjectId,
  fileId: string,
  rawBody: unknown,
) => {
  if (!FILE_ID.test(fileId)) {
    throw new HttpError(400, "invalid_file_id");
  }
  const body = fileBody.parse(rawBody);
  const check = ALLOWED_FILE_TYPES[body.mimeType];
  if (!check) {
    throw new HttpError(415, "unsupported_media_type");
  }
  const data = Buffer.from(body.dataBase64, "base64");
  if (data.length === 0 || data.length > MAX_FILE_BYTES) {
    throw new HttpError(413, "file_too_large");
  }
  if (!check(data)) {
    throw new HttpError(415, "content_does_not_match_type");
  }
  await app.storage.put(sceneFileKey(sceneId, fileId), data, body.mimeType);
};

export const sendSceneFile = async (
  app: FastifyInstance,
  sceneId: ObjectId,
  fileId: string,
  reply: import("fastify").FastifyReply,
  cache = "private, max-age=31536000, immutable",
) => {
  if (!FILE_ID.test(fileId)) {
    throw new HttpError(404, "not_found");
  }
  const file = await app.storage.get(sceneFileKey(sceneId, fileId));
  if (!file) {
    throw new HttpError(404, "not_found");
  }
  // Uploaded content is untrusted: never let it execute as a document.
  return reply
    .header("content-security-policy", "default-src 'none'; sandbox")
    .header("cache-control", cache)
    .type(file.contentType)
    .send(file.data);
};
