import { EXPORT_DATA_TYPES } from "@excalidraw/common";
import { isValidExcalidrawData } from "./json";

describe("isValidExcalidrawData", () => {
  describe("standard validation (lenient: false)", () => {
    it("should accept valid excalidraw data with type field", () => {
      const validData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(validData, false)).toBe(true);
    });

    it("should accept valid excalidraw data with elements", () => {
      const validData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [
          {
            id: "test-id",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
        appState: {},
      };
      expect(isValidExcalidrawData(validData, false)).toBe(true);
    });

    it("should accept valid excalidraw data without elements", () => {
      const validData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        appState: {},
      };
      expect(isValidExcalidrawData(validData, false)).toBe(true);
    });

    it("should accept valid excalidraw data without appState", () => {
      const validData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
      };
      expect(isValidExcalidrawData(validData, false)).toBe(true);
    });

    it("should reject data without type field", () => {
      const invalidData = {
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(invalidData, false)).toBe(false);
    });

    it("should reject data with wrong type", () => {
      const invalidData = {
        type: "wrong-type",
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(invalidData, false)).toBe(false);
    });

    it("should reject data with non-array elements", () => {
      const invalidData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: "not-an-array",
        appState: {},
      };
      expect(isValidExcalidrawData(invalidData, false)).toBe(false);
    });

    it("should reject data with non-object appState", () => {
      const invalidData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
        appState: "not-an-object",
      };
      expect(isValidExcalidrawData(invalidData, false)).toBe(false);
    });

    it("should reject null or undefined data", () => {
      expect(isValidExcalidrawData(null, false)).toBe(false);
      expect(isValidExcalidrawData(undefined, false)).toBe(false);
    });
  });

  describe("lenient validation (lenient: true)", () => {
    it("should accept data without type field but with valid structure", () => {
      const manuallyCreatedData = {
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(manuallyCreatedData, true)).toBe(true);
    });

    it("should accept manually created file with elements", () => {
      const manuallyCreatedData = {
        elements: [
          {
            id: "test-id",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
        appState: {
          viewBackgroundColor: "#ffffff",
        },
      };
      expect(isValidExcalidrawData(manuallyCreatedData, true)).toBe(true);
    });

    it("should accept manually created file without elements", () => {
      const manuallyCreatedData = {
        appState: {},
      };
      expect(isValidExcalidrawData(manuallyCreatedData, true)).toBe(true);
    });

    it("should accept manually created file without appState", () => {
      const manuallyCreatedData = {
        elements: [],
      };
      expect(isValidExcalidrawData(manuallyCreatedData, true)).toBe(true);
    });

    it("should accept manually created file with files object", () => {
      const manuallyCreatedData = {
        elements: [],
        appState: {},
        files: {
          "file-id": {
            mimeType: "image/png",
            dataURL: "data:image/png;base64,...",
          },
        },
      };
      expect(isValidExcalidrawData(manuallyCreatedData, true)).toBe(true);
    });

    it("should reject data with non-array elements in lenient mode", () => {
      const invalidData = {
        elements: "not-an-array",
        appState: {},
      };
      expect(isValidExcalidrawData(invalidData, true)).toBe(false);
    });

    it("should reject data with non-object appState in lenient mode", () => {
      const invalidData = {
        elements: [],
        appState: "not-an-object",
      };
      expect(isValidExcalidrawData(invalidData, true)).toBe(false);
    });

    it("should reject data with non-object files in lenient mode", () => {
      const invalidData = {
        elements: [],
        appState: {},
        files: "not-an-object",
      };
      expect(isValidExcalidrawData(invalidData, true)).toBe(false);
    });

    it("should reject null or undefined data in lenient mode", () => {
      expect(isValidExcalidrawData(null, true)).toBe(false);
      expect(isValidExcalidrawData(undefined, true)).toBe(false);
    });

    it("should accept data with type field in lenient mode (backward compatibility)", () => {
      const validData = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(validData, true)).toBe(true);
    });
  });

  describe("default behavior (lenient: undefined)", () => {
    it("should default to strict validation when lenient is undefined", () => {
      const dataWithoutType = {
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(dataWithoutType)).toBe(false);

      const dataWithType = {
        type: EXPORT_DATA_TYPES.excalidraw,
        elements: [],
        appState: {},
      };
      expect(isValidExcalidrawData(dataWithType)).toBe(true);
    });
  });
});


