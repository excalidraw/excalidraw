import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./scenesRepository.js", () => ({
  getScene: vi.fn(),
  saveScene: vi.fn(),
}));

import { getScene, saveScene } from "./scenesRepository.js";
import { scenesRouter } from "./scenesRouter.js";

const app = express();
app.use(express.json());
app.use("/api/scenes", scenesRouter);

beforeEach(() => {
  vi.mocked(getScene).mockReset();
  vi.mocked(saveScene).mockReset();
});

describe("GET /api/scenes/:roomId", () => {
  it("returns 404 for an unknown room", async () => {
    vi.mocked(getScene).mockResolvedValue(null);
    expect((await request(app).get("/api/scenes/room-1")).status).toBe(404);
  });

  it("returns base64-encoded scene data", async () => {
    vi.mocked(getScene).mockResolvedValue({
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.from("iv"),
      revision: 3,
    });

    const response = await request(app).get("/api/scenes/room-1");
    expect(response.body).toEqual({
      ciphertext: Buffer.from("cipher").toString("base64"),
      iv: Buffer.from("iv").toString("base64"),
      revision: 3,
    });
  });
});

describe("PUT /api/scenes/:roomId", () => {
  it("rejects malformed and invalid base64 bodies", async () => {
    expect((await request(app).put("/api/scenes/room-1").send({})).status).toBe(
      400,
    );
    expect(
      (
        await request(app).put("/api/scenes/room-1").send({
          ciphertext: "not-base64!",
          iv: "aXY=",
          expectedRevision: 0,
        })
      ).status,
    ).toBe(400);
  });

  it("returns 409 with the current scene on a revision conflict", async () => {
    vi.mocked(saveScene).mockResolvedValue({
      accepted: false,
      current: {
        ciphertext: Buffer.from("v1"),
        iv: Buffer.from("iv1"),
        revision: 1,
      },
    });

    const response = await request(app).put("/api/scenes/room-1").send({
      ciphertext: "Yw==",
      iv: "aXY=",
      expectedRevision: 0,
    });
    expect(response.status).toBe(409);
    expect(response.body.current.revision).toBe(1);
  });

  it("returns the new revision on success", async () => {
    vi.mocked(saveScene).mockResolvedValue({ accepted: true, revision: 1 });
    const response = await request(app).put("/api/scenes/room-1").send({
      ciphertext: "Yw==",
      iv: "aXY=",
      expectedRevision: 0,
    });
    expect(response.body).toEqual({ revision: 1 });
  });
});
