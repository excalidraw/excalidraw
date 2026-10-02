import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";

import { draftIsAhead, toSaveFailure, uploadPendingFiles } from "./sceneIO";

const el = (id: string, version: number, versionNonce = 1) => ({
  id,
  version,
  versionNonce,
});

describe("draftIsAhead", () => {
  it("is false when the server has everything at the same or newer version", () => {
    expect(draftIsAhead([el("a", 2)], [el("a", 2), el("b", 1)])).toBe(false);
    expect(draftIsAhead([el("a", 1)], [el("a", 3)])).toBe(false);
    expect(draftIsAhead([], [el("a", 1)])).toBe(false);
  });
  it("is true for new elements or newer versions", () => {
    expect(draftIsAhead([el("new", 1)], [el("a", 1)])).toBe(true);
    expect(draftIsAhead([el("a", 4)], [el("a", 3)])).toBe(true);
  });
  it("uses the lower nonce as the tie-breaker (same rule as the reconciler)", () => {
    expect(draftIsAhead([el("a", 2, 5)], [el("a", 2, 9)])).toBe(true);
    expect(draftIsAhead([el("a", 2, 9)], [el("a", 2, 5)])).toBe(false);
  });
});

describe("toSaveFailure", () => {
  it("retries network, 5xx and rate-limit errors; stops on permission/size errors", () => {
    expect(toSaveFailure(new ApiError(0, "network_error")).retryable).toBe(
      true,
    );
    expect(toSaveFailure(new ApiError(503, "x")).retryable).toBe(true);
    expect(toSaveFailure(new ApiError(429, "x")).retryable).toBe(true);
    expect(toSaveFailure(new ApiError(403, "forbidden")).retryable).toBe(false);
    expect(toSaveFailure(new ApiError(404, "not_found")).retryable).toBe(false);
    expect(toSaveFailure(new ApiError(413, "too_big")).message).toMatch(
      /too large/,
    );
    expect(toSaveFailure(new ApiError(401, "x")).message).toMatch(/session/);
  });
});

describe("uploadPendingFiles", () => {
  const png = "data:image/png;base64,AAAA";
  it("uploads each referenced file once and skips ones the server already has", async () => {
    const calls: string[] = [];
    const put = (async (p: string, b: any) => {
      calls.push(`${p}:${b.mimeType}`);
    }) as any;
    const uploaded = new Set<string>(["old"]);
    const files: any = {
      new1: { dataURL: png },
      old: { dataURL: png },
      unused: { dataURL: png },
    };
    const elements = [
      { type: "image", fileId: "new1" },
      { type: "image", fileId: "old" },
      { type: "image", fileId: "gone", isDeleted: true },
      { type: "rectangle" },
    ];
    await uploadPendingFiles(
      files,
      elements,
      uploaded,
      (id) => `/f/${id}`,
      put,
    );
    await uploadPendingFiles(
      files,
      elements,
      uploaded,
      (id) => `/f/${id}`,
      put,
    );
    expect(calls).toEqual(["/f/new1:image/png"]);
  });
  it("does not mark a file uploaded when the request fails (so it is retried)", async () => {
    const uploaded = new Set<string>();
    const files: any = { f: { dataURL: png } };
    const failing = (async () => {
      throw new ApiError(0, "network_error");
    }) as any;
    await expect(
      uploadPendingFiles(
        files,
        [{ type: "image", fileId: "f" }],
        uploaded,
        (i) => i,
        failing,
      ),
    ).rejects.toBeInstanceOf(ApiError);
    expect(uploaded.size).toBe(0);
  });
});
