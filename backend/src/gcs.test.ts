import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const downloadMock = vi.fn();
const fileMock = vi.fn(() => ({ save: saveMock, download: downloadMock }));
const bucketMock = vi.fn(() => ({ file: fileMock }));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn(() => ({ bucket: bucketMock })),
}));

vi.mock("./env.js", () => ({ env: { gcsBucket: "test-bucket" } }));

import { downloadObject, uploadObject } from "./gcs.js";

beforeEach(() => {
  saveMock.mockReset();
  downloadMock.mockReset();
  fileMock.mockClear();
  bucketMock.mockClear();
});

it("uploads an object to the configured bucket", async () => {
  saveMock.mockResolvedValue(undefined);
  await uploadObject("rooms/room-1/file-1", Buffer.from("data"));
  expect(bucketMock).toHaveBeenCalledWith("test-bucket");
  expect(fileMock).toHaveBeenCalledWith("rooms/room-1/file-1");
  expect(saveMock).toHaveBeenCalledWith(Buffer.from("data"), {
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
});

it("downloads an object from the configured bucket", async () => {
  downloadMock.mockResolvedValue([Buffer.from("data")]);
  expect((await downloadObject("rooms/room-1/file-1")).toString()).toBe("data");
});
