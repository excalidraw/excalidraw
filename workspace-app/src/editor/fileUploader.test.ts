import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";

import { createFileUploader } from "./fileUploader";

const png = "data:image/png;base64,AAAA";
const files: any = { a: { dataURL: png }, b: { dataURL: png } };
const els = [
  { type: "image", fileId: "a" },
  { type: "image", fileId: "b" },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("file uploader", () => {
  it("uploads each file once even when sync is called on every change", async () => {
    const put = vi.fn(async () => {}) as any;
    const u = createFileUploader((id) => `/f/${id}`, put);
    for (let i = 0; i < 20; i++) {
      u.sync(files, els);
    }
    await vi.runAllTimersAsync();
    expect(put.mock.calls.map((c: any) => c[0]).sort()).toEqual([
      "/f/a",
      "/f/b",
    ]);
  });

  it("does not re-upload files marked as already on the server", async () => {
    const put = vi.fn(async () => {}) as any;
    const u = createFileUploader((id) => `/f/${id}`, put);
    u.markUploaded(["a"]);
    await u.ensure(files, els);
    expect(put.mock.calls.map((c: any) => c[0])).toEqual(["/f/b"]);
  });

  it("retries with backoff after network errors until it succeeds", async () => {
    let failing = 2;
    const put = vi.fn(async () => {
      if (failing-- > 0) {
        throw new ApiError(0, "network_error");
      }
    }) as any;
    const u = createFileUploader((id) => `/f/${id}`, put, 1000);
    u.sync({ a: files.a }, [els[0]]);
    await vi.advanceTimersByTimeAsync(10);
    expect(put).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100); // first retry (fails)
    expect(put).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2100); // second retry (succeeds)
    expect(put).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(put).toHaveBeenCalledTimes(3); // done: no further attempts
  });

  it("gives up on permanently rejected files instead of looping", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const put = vi.fn(async () => {
      throw new ApiError(415, "unsupported_media_type", "nope");
    }) as any;
    const u = createFileUploader((id) => `/f/${id}`, put, 500);
    u.sync({ a: files.a }, [els[0]]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(put).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("ensure() rejects so a scene save can wait for its images", async () => {
    const put = vi.fn(async () => {
      throw new ApiError(503, "down");
    }) as any;
    const u = createFileUploader((id) => `/f/${id}`, put);
    await expect(u.ensure({ a: files.a }, [els[0]])).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("retry() resumes after connectivity returns; dispose() stops timers", async () => {
    let failing = true;
    const put = vi.fn(async () => {
      if (failing) {
        throw new ApiError(0, "network_error");
      }
    }) as any;
    const u = createFileUploader((id) => `/f/${id}`, put, 100000);
    u.sync({ a: files.a }, [els[0]]);
    await vi.advanceTimersByTimeAsync(10);
    failing = false;
    u.retry();
    await vi.advanceTimersByTimeAsync(10);
    expect(put).toHaveBeenCalledTimes(2);
    u.dispose();
  });
});
