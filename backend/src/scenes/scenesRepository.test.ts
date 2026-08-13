import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { scene } = vi.hoisted(() => ({
  scene: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../db.js", () => ({ prisma: { scene } }));

import { getScene, saveScene } from "./scenesRepository.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getScene", () => {
  it("returns null for an unknown room", async () => {
    scene.findUnique.mockResolvedValue(null);
    await expect(getScene("missing")).resolves.toBeNull();
  });
});

describe("saveScene", () => {
  it("creates revision 1 when expectedRevision is zero", async () => {
    scene.create.mockResolvedValue({ revision: 1 });
    await expect(
      saveScene("room-1", Buffer.from("cipher"), Buffer.from("iv"), 0),
    ).resolves.toEqual({ accepted: true, revision: 1 });
  });

  it("returns the current scene when a concurrent create wins", async () => {
    scene.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
    );
    scene.findUnique.mockResolvedValue({
      ciphertext: Buffer.from("current"),
      iv: Buffer.from("iv"),
      revision: 1,
    });

    const result = await saveScene(
      "room-1",
      Buffer.from("stale"),
      Buffer.from("iv"),
      0,
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.current.ciphertext.toString()).toBe("current");
    }
  });

  it("does not swallow non-unique database errors", async () => {
    scene.create.mockRejectedValue(new Error("database unavailable"));
    await expect(
      saveScene("room-1", Buffer.from("cipher"), Buffer.from("iv"), 0),
    ).rejects.toThrow("database unavailable");
  });

  it("atomically increments when the expected revision matches", async () => {
    scene.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      saveScene("room-1", Buffer.from("v2"), Buffer.from("iv"), 1),
    ).resolves.toEqual({ accepted: true, revision: 2 });
    expect(scene.updateMany).toHaveBeenCalledWith({
      where: { roomId: "room-1", revision: 1 },
      data: {
        ciphertext: Buffer.from("v2"),
        iv: Buffer.from("iv"),
        revision: { increment: 1 },
      },
    });
  });

  it("returns the current scene when compare-and-swap loses", async () => {
    scene.updateMany.mockResolvedValue({ count: 0 });
    scene.findUnique.mockResolvedValue({
      ciphertext: Buffer.from("v3"),
      iv: Buffer.from("iv"),
      revision: 3,
    });
    const result = await saveScene(
      "room-1",
      Buffer.from("v2"),
      Buffer.from("iv"),
      1,
    );
    expect(result).toMatchObject({
      accepted: false,
      current: { revision: 3 },
    });
  });
});
