import { MIME_TYPES } from "@excalidraw/common";
import { loadSceneOrLibraryFromBlob } from "./blob";
import { ImageSceneDataError } from "../errors";

describe("loadSceneOrLibraryFromBlob", () => {
  describe("manually created .excalidraw files", () => {
    it("should load manually created file without type field", async () => {
      const manuallyCreatedFile = {
        elements: [],
        appState: {
          viewBackgroundColor: "#ffffff",
        },
      };

      const blob = new Blob([JSON.stringify(manuallyCreatedFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      const result = await loadSceneOrLibraryFromBlob(file, null, null, null);

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
      expect(result.data.elements).toEqual([]);
    });

    it("should load manually created file with elements", async () => {
      const manuallyCreatedFile = {
        elements: [
          {
            id: "test-id-1",
            type: "rectangle",
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            angle: 0,
            strokeColor: "#000000",
            backgroundColor: "transparent",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            seed: 12345,
            version: 1,
            versionNonce: 67890,
            index: null,
            isDeleted: false,
            groupIds: [],
            frameId: null,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            roundness: null,
          },
        ],
        appState: {},
      };

      const blob = new Blob([JSON.stringify(manuallyCreatedFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      const result = await loadSceneOrLibraryFromBlob(file, null, null, null);

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
      expect(result.data.elements.length).toBeGreaterThan(0);
    });

    it("should load manually created file without appState", async () => {
      const manuallyCreatedFile = {
        elements: [],
      };

      const blob = new Blob([JSON.stringify(manuallyCreatedFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      const result = await loadSceneOrLibraryFromBlob(file, null, null, null);

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
    });

    it("should load manually created file with files object", async () => {
      const manuallyCreatedFile = {
        elements: [],
        appState: {},
        files: {
          "file-id-1": {
            mimeType: "image/png",
            id: "file-id-1",
            dataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            created: Date.now(),
            lastRetrieved: Date.now(),
          },
        },
      };

      const blob = new Blob([JSON.stringify(manuallyCreatedFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      const result = await loadSceneOrLibraryFromBlob(file, null, null, null);

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
    });

    it("should still load standard excalidraw files with type field", async () => {
      const standardFile = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: {},
      };

      const blob = new Blob([JSON.stringify(standardFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      const result = await loadSceneOrLibraryFromBlob(file, null, null, null);

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
    });
  });

  describe("invalid files", () => {
    it("should reject invalid JSON", async () => {
      const blob = new Blob(["invalid json {"]);

      await expect(
        loadSceneOrLibraryFromBlob(blob, null, null, null),
      ).rejects.toThrow("Error: invalid file");
    });

    it("should reject file without .excalidraw extension and without type field", async () => {
      const invalidFile = {
        elements: [],
        appState: {},
      };

      const blob = new Blob([JSON.stringify(invalidFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.json", {
        type: MIME_TYPES.json,
      });

      await expect(
        loadSceneOrLibraryFromBlob(file, null, null, null),
      ).rejects.toThrow("Error: invalid file");
    });

    it("should reject file with invalid structure", async () => {
      const invalidFile = {
        elements: "not-an-array",
        appState: {},
      };

      const blob = new Blob([JSON.stringify(invalidFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      await expect(
        loadSceneOrLibraryFromBlob(file, null, null, null),
      ).rejects.toThrow("Error: invalid file");
    });
  });

  describe("file handle support", () => {
    it("should work with file handle name", async () => {
      const manuallyCreatedFile = {
        elements: [],
        appState: {},
      };

      const blob = new Blob([JSON.stringify(manuallyCreatedFile)], {
        type: MIME_TYPES.json,
      });
      const file = new File([blob], "test.excalidraw", {
        type: MIME_TYPES.excalidraw,
      });

      // Mock file handle
      const mockHandle = {
        name: "test.excalidraw",
      } as any;

      const result = await loadSceneOrLibraryFromBlob(
        file,
        null,
        null,
        mockHandle,
      );

      expect(result.type).toBe(MIME_TYPES.excalidraw);
      expect(result.data).toBeDefined();
    });
  });
});

