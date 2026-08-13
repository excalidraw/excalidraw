import { prisma } from "../db.js";
import { downloadObject, uploadObject } from "../gcs.js";

const gcsPathFor = (roomId: string, fileId: string): string =>
  `rooms/${roomId}/${fileId}`;

export async function saveFile(
  roomId: string,
  fileId: string,
  data: Buffer,
): Promise<void> {
  const gcsPath = gcsPathFor(roomId, fileId);
  await uploadObject(gcsPath, data);
  await prisma.sceneFile.upsert({
    where: { roomId_id: { roomId, id: fileId } },
    create: { id: fileId, roomId, gcsPath },
    update: { gcsPath },
  });
}

export async function loadFile(
  roomId: string,
  fileId: string,
): Promise<Buffer | null> {
  const record = await prisma.sceneFile.findUnique({
    where: { roomId_id: { roomId, id: fileId } },
  });
  return record ? downloadObject(record.gcsPath) : null;
}
