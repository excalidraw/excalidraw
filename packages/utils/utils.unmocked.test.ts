import { decodePngMetadata } from "@excalidraw/excalidraw/data/image";
import { decodeSvgBase64Payload } from "@excalidraw/excalidraw/scene/export";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

import * as utils from "./index";

// NOTE this test file is using the actual API, unmocked. Hence splitting it
// from the other test file, because I couldn't figure out how to test
// mocked and unmocked API in the same file.

describe("embedding scene data", () => {
  describe("exportToSvg", () => {
    it("embedding scene data shouldn't modify them", async () => {
      const rectangle = API.createElement({ type: "rectangle" });
      const ellipse = API.createElement({ type: "ellipse" });

      const sourceElements = [rectangle, ellipse];

      const svgNode = await utils.exportToSvg({
        elements: sourceElements,
        appState: {
          viewBackgroundColor: "#ffffff",
          gridModeEnabled: false,
          exportEmbedScene: true,
        },
        files: null,
      });

      const svg = svgNode.outerHTML;

      const parsedString = decodeSvgBase64Payload({ svg });
      const importedData: ImportedDataState = JSON.parse(parsedString);

      expect(sourceElements.map((x) => x.id)).toEqual(
        importedData.elements?.map((el) => el.id),
      );
    });
  });

  // skipped because we can't test png encoding right now
  // (canvas.toBlob not supported in jsdom)
  describe.skip("exportToBlob", () => {
    it("embedding scene data shouldn't modify them", async () => {
      const rectangle = API.createElement({ type: "rectangle" });
      const ellipse = API.createElement({ type: "ellipse" });

      const sourceElements = [rectangle, ellipse];

      const blob = await utils.exportToBlob({
        mimeType: "image/png",
        elements: sourceElements,
        appState: {
          viewBackgroundColor: "#ffffff",
          gridModeEnabled: false,
          exportEmbedScene: true,
        },
        files: null,
      });

      const parsedString = await decodePngMetadata(blob);
      const importedData: ImportedDataState = JSON.parse(parsedString);

      expect(sourceElements.map((x) => x.id)).toEqual(
        importedData.elements?.map((el) => el.id),
      );
    });
  });
});
