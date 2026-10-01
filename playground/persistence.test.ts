import { newElement, newImageElement } from "@excalidraw/element";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import type { FileId } from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { DataURL } from "@excalidraw/excalidraw/types";

import { loadScene, saveScene } from "./persistence";

describe("playground persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("when nothing was saved", () => {
    let scene: ImportedDataState | null;

    beforeEach(() => {
      scene = loadScene(localStorage);
    });

    it("loads no scene", () => {
      expect(scene).toBeNull();
    });
  });

  describe("when a scene was saved at 10,000%", () => {
    const thunderwrench = newElement({ type: "rectangle", x: 7, y: 11 });
    const rustyConquistador = {
      ...newElement({ type: "ellipse", x: 13, y: 17 }),
      isDeleted: true,
    };
    let scene: ImportedDataState | null;

    beforeEach(() => {
      saveScene(
        localStorage,
        [thunderwrench, rustyConquistador],
        { ...getDefaultAppState(), zoom: { value: getNormalizedZoom(100) } },
        {},
      );
      scene = loadScene(localStorage);
    });

    it("keeps only the live elements", () => {
      expect(scene?.elements?.map(({ id }) => id)).toEqual([thunderwrench.id]);
    });

    it("keeps the zoom", () => {
      expect(scene?.appState?.zoom).toEqual({ value: 100 });
    });
  });

  describe("when an image was deleted before the save", () => {
    const valleyOfTheSun = {
      ...newImageElement({ type: "image", x: 3, y: 5 }),
      fileId: "file-id-valley-of-the-sun" as FileId,
      isDeleted: true,
    };
    let scene: ImportedDataState | null;

    beforeEach(() => {
      saveScene(localStorage, [valleyOfTheSun], getDefaultAppState(), {
        [valleyOfTheSun.fileId]: {
          id: valleyOfTheSun.fileId,
          mimeType: "image/png",
          dataURL: "data:image/png;base64,THELAIR" as DataURL,
          created: 1,
        },
      });
      scene = loadScene(localStorage);
    });

    it("drops its file", () => {
      expect(scene?.files).toEqual({});
    });
  });
});
