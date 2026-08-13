import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./filesRepository.js", () => ({
  saveFile: vi.fn(),
  loadFile: vi.fn(),
}));

import { loadFile, saveFile } from "./filesRepository.js";
import { filesRouter } from "./filesRouter.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/api/files", filesRouter);

beforeEach(() => {
  vi.mocked(saveFile).mockReset();
  vi.mocked(loadFile).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/files/:roomId", () => {
  it("rejects malformed file entries", async () => {
    const response = await request(app)
      .post("/api/files/room-1")
      .send({ files: [{ fileId: "file-1", data: "invalid!" }] });
    expect(response.status).toBe(400);
  });

  it("reports per-file success and failure", async () => {
    vi.mocked(saveFile).mockImplementation(async (_room, fileId) => {
      if (fileId === "bad") {
        throw new Error("boom");
      }
    });

    const response = await request(app)
      .post("/api/files/room-1")
      .send({
        files: [
          { fileId: "good", data: "ZGF0YQ==" },
          { fileId: "bad", data: "ZGF0YQ==" },
        ],
      });
    expect(response.body).toEqual({
      savedFiles: ["good"],
      erroredFiles: ["bad"],
    });
  });
});

describe("GET /api/files/:roomId", () => {
  it("returns loaded and errored files by id", async () => {
    vi.mocked(loadFile).mockImplementation(async (_room, fileId) =>
      fileId === "missing" ? null : Buffer.from("data"),
    );
    const response = await request(app).get(
      "/api/files/room-1?ids=present,missing",
    );
    expect(response.body).toEqual({
      loadedFiles: [{ fileId: "present", data: "ZGF0YQ==" }],
      erroredFiles: ["missing"],
    });
  });
});
