import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decryptData,
  encryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { isSceneSaved, saveFiles, saveScene } from "./backend";

import type { AppState } from "@excalidraw/excalidraw/types";
import type Portal from "../collab/Portal";

const bytesToBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < array.length; index++) {
    binary += String.fromCharCode(array[index]);
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const encryptScene = async (
  roomKey: string,
  elements: unknown[],
  revision: number,
) => {
  const { encryptedBuffer, iv } = await encryptData(
    roomKey,
    new TextEncoder().encode(JSON.stringify(elements)),
  );
  return {
    ciphertext: bytesToBase64(encryptedBuffer),
    iv: bytesToBase64(iv),
    revision,
  };
};

const decryptRequestBody = async (roomKey: string, body: string) => {
  const { ciphertext, iv } = JSON.parse(body);
  const decrypted = await decryptData(
    base64ToBytes(iv),
    base64ToBytes(ciphertext),
    roomKey,
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("isSceneSaved", () => {
  it("returns true when there is no active room", () => {
    const portal = { socket: null, roomId: null, roomKey: null } as Portal;
    expect(isSceneSaved(portal, [])).toBe(true);
  });
});

describe("saveFiles", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("posts base64-encoded files", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ savedFiles: ["file-1"], erroredFiles: [] }),
    } as Response);

    const result = await saveFiles({
      roomId: "room-1",
      files: [{ id: "file-1" as never, buffer: new Uint8Array([1, 2, 3]) }],
    });
    expect(result).toEqual({ savedFiles: ["file-1"], erroredFiles: [] });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/api/files/room-1");
    expect(JSON.parse(options?.body as string).files[0]).toEqual({
      fileId: "file-1",
      data: "AQID",
    });
  });

  it("reports all files as errors when fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const result = await saveFiles({
      roomId: "room-1",
      files: [{ id: "file-1" as never, buffer: new Uint8Array([1]) }],
    });
    expect(result).toEqual({ savedFiles: [], erroredFiles: ["file-1"] });
  });
});

describe("saveScene", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps local edits while reconciling a fresher scene after a 409", async () => {
    const roomKey = await generateEncryptionKey();
    const portal = {
      socket: {},
      roomId: "room-1",
      roomKey,
    } as unknown as Portal;
    const localElement = API.createElement({ id: "local", x: 0 });
    const remoteElement = API.createElement({ id: "remote", x: 500 });
    const storedAtRevision5 = await encryptScene(roomKey, [], 5);
    const storedAtRevision6 = await encryptScene(roomKey, [remoteElement], 6);

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => storedAtRevision5,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ current: storedAtRevision6 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ revision: 7 }),
      } as Response);

    await saveScene(portal, [localElement] as never, {} as AppState);

    expect(fetch).toHaveBeenCalledTimes(3);
    const [, secondPutOptions] = vi.mocked(fetch).mock.calls[2];
    expect(JSON.parse(secondPutOptions?.body as string).expectedRevision).toBe(
      6,
    );
    const reconciled = await decryptRequestBody(
      roomKey,
      secondPutOptions?.body as string,
    );
    expect(reconciled.map(({ id }: { id: string }) => id)).toEqual(
      expect.arrayContaining(["local", "remote"]),
    );
  });
});
