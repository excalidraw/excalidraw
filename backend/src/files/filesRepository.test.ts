import { beforeEach, describe, expect, it, vi } from "vitest";

const { sceneFile } = vi.hoisted(() => ({
  sceneFile: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("../db.js", () => ({ prisma: { sceneFile } }));
vi.mock("../gcs.js", () => ({
  uploadObject: vi.fn(),
  downloadObject: vi.fn(),
}));

import { downloadObject, uploadObject } from "../gcs.js";
import { loadFile, saveFile } from "./filesRepository.js";

beforeEach(() => {
  vi.clearAllMocks();
});

it("uploads and records a file under its room", async () => {
  await saveFile("room-1", "file-1", Buffer.from("data"));
  expect(uploadObject).toHaveBeenCalledWith(
    "rooms/room-1/file-1",
    Buffer.from("data"),
  );
  expect(sceneFile.upsert).toHaveBeenCalledWith({
    where: { roomId_id: { roomId: "room-1", id: "file-1" } },
    create: {
      id: "file-1",
      roomId: "room-1",
      gcsPath: "rooms/room-1/file-1",
    },
    update: { gcsPath: "rooms/room-1/file-1" },
  });
});

it("returns null when the file is not recorded in that room", async () => {
  sceneFile.findUnique.mockResolvedValue(null);
  await expect(loadFile("room-1", "missing")).resolves.toBeNull();
  expect(downloadObject).not.toHaveBeenCalled();
});

it("downloads the path recorded for the room and file", async () => {
  sceneFile.findUnique.mockResolvedValue({
    gcsPath: "rooms/room-1/file-1",
  });
  vi.mocked(downloadObject).mockResolvedValue(Buffer.from("data"));
  await expect(loadFile("room-1", "file-1")).resolves.toEqual(
    Buffer.from("data"),
  );
});
