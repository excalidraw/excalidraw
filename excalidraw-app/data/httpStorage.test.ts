import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSceneVersion } from "@excalidraw/element";

import { saveToHttpStorage } from "./httpStorage";

import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";
import type { SyncableExcalidrawElement } from ".";
import type { AppState } from "../../packages/excalidraw/types";

// Mock environment variable
vi.stubEnv("VITE_APP_HTTP_STORAGE_BACKEND_URL", "http://test-backend.local");

// Mock dependencies
vi.mock("../../packages/excalidraw/data/reconcile", () => ({
  reconcileElements: vi.fn((local, remote) => [...local, ...remote]),
}));

vi.mock("../../packages/excalidraw/data/encryption", () => ({
  encryptData: vi.fn(async () => ({
    encryptedBuffer: new ArrayBuffer(16),
    iv: new Uint8Array(12),
  })),
  decryptData: vi.fn(async () => {
    // Return valid JSON string as ArrayBuffer
    const jsonString = JSON.stringify([]);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer;
  }),
  IV_LENGTH_BYTES: 12,
}));

vi.mock("../../packages/excalidraw/data/restore", () => ({
  restoreElements: vi.fn((elements) => elements),
}));

vi.mock("../../packages/excalidraw/data/encode", () => ({
  decompressData: vi.fn(async (data) => data), // Pass through
}));

describe("httpStorage", () => {
  let mockPortal: Portal;
  let mockElements: SyncableExcalidrawElement[];
  let mockAppState: AppState;

  beforeEach(() => {
    mockPortal = {
      socket: { id: "test-socket" } as Socket,
      roomId: "test-room-id",
      roomKey: "test-room-key",
    } as Portal;

    mockElements = [
      {
        id: "element-1",
        type: "rectangle",
        version: 1,
        versionNonce: 123,
        isDeleted: false,
        updated: 1000,
      },
    ] as SyncableExcalidrawElement[];

    mockAppState = {} as AppState;
  });

  describe("inconsistent return values", () => {
    it("should return reconciledElements in fallback path", async () => {
      const sceneVersion = getSceneVersion(mockElements);
      const serverVersion = sceneVersion + 1;

      const mockBuffer = new ArrayBuffer(4 + 12 + 100);
      const view = new DataView(mockBuffer);
      view.setUint32(0, serverVersion, false);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => mockBuffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const result = await saveToHttpStorage(
        mockPortal,
        mockElements,
        mockAppState,
      );

      expect(result).not.toBe(false);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return reconciledElements in normal path (FIXED)", async () => {
      const sceneVersion = getSceneVersion(mockElements);
      const serverVersion = sceneVersion - 1;

      const mockBuffer = new ArrayBuffer(4 + 12 + 100);
      const view = new DataView(mockBuffer);
      view.setUint32(0, serverVersion, false);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => mockBuffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const result = await saveToHttpStorage(
        mockPortal,
        mockElements,
        mockAppState,
      );

      expect(result).not.toBe(false);
      expect(Array.isArray(result)).toBe(true);
      // The result should be the reconciled elements, not the original elements
      expect(result).not.toBe(mockElements);
    });
  });

  describe("404 path consistency with firebase", () => {
    it("should return new array in 404 path (new room)", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const result = await saveToHttpStorage(
        mockPortal,
        mockElements,
        mockAppState,
      );

      expect(result).not.toBe(false);
      expect(Array.isArray(result)).toBe(true);
      expect(result).not.toBe(mockElements); // Should be new array
    });
  });
});
