import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export type StoredScene = {
  ciphertext: Buffer;
  iv: Buffer;
  revision: number;
};

export type SaveResult =
  | { accepted: true; revision: number }
  | { accepted: false; current: StoredScene };

export async function getScene(roomId: string): Promise<StoredScene | null> {
  const scene = await prisma.scene.findUnique({ where: { roomId } });
  return scene
    ? {
        ciphertext: Buffer.from(scene.ciphertext),
        iv: Buffer.from(scene.iv),
        revision: scene.revision,
      }
    : null;
}

export async function saveScene(
  roomId: string,
  ciphertext: Buffer,
  iv: Buffer,
  expectedRevision: number,
): Promise<SaveResult> {
  if (expectedRevision === 0) {
    try {
      const created = await prisma.scene.create({
        data: { roomId, ciphertext, iv, revision: 1 },
      });
      return { accepted: true, revision: created.revision };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
      const current = await getScene(roomId);
      if (!current) {
        throw new Error(`Room ${roomId} failed to create and does not exist`);
      }
      return { accepted: false, current };
    }
  }

  const result = await prisma.scene.updateMany({
    where: { roomId, revision: expectedRevision },
    data: { ciphertext, iv, revision: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await getScene(roomId);
    if (!current) {
      throw new Error(`Room ${roomId} does not exist`);
    }
    return { accepted: false, current };
  }

  return { accepted: true, revision: expectedRevision + 1 };
}
