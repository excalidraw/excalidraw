import * as utils from "../../packages/utils";
import { diagramFactory } from "../fixtures/diagramFixture";

describe("exportToCanvas", () => {
  const EXPORT_PADDING = 10;

  it("with default arguments", () => {
    const canvas = utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("when custom width and height", () => {
    const canvas = utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      getDimensions: () => ({ width: 200, height: 200, scale: 1 }),
    });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });
});

describe("exportToBlob", () => {
  describe("mime type", () => {
    afterEach(jest.restoreAllMocks);

    it("should change image/jpg to image/jpeg", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
        getDimensions: (width, height) => ({ width, height, scale: 1 }),
        mimeType: "image/jpg",
      });
      expect(blob?.type).toBe("image/jpeg");
    });

    it("should default to image/png", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
      });
      expect(blob?.type).toBe("image/png");
    });

    it("should warn when using quality with image/png", async () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);

      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: "image/png",
        quality: 1,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '"quality" will be ignored for "image/png" mimeType',
      );
    });
  });
});

describe("exportToSvg", () => {
  it("with default arguments", () => {
    //TODO:
    // const svgElement = utils.exportToSvg({
    //   ...diagramFactory({
    //     overrides: { appState: void 0 },
    //     elementOverrides: { width: 100, height: 100 },
    //   }),
    // });
    // expect(svgElement).toMatchSnapshot();
  });

  it("with exportPadding and metadata", () => {
    // const svgElement = utils.exportToSvg({
    //   ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    //   exportPadding: 0,
    //   metadata: "some metadata",
    // });
    // expect(svgElement.innerHTML).toMatch(/some metadata/);
    // expect(svgElement).toHaveAttribute("height", "100");
    // expect(svgElement).toHaveAttribute("width", "100");
    // expect(svgElement).toHaveAttribute("viewBox", "0 0 100 100");
  });
});
