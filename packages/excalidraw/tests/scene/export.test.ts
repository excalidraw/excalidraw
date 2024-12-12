import type {
  ExcalidrawTextElement,
  FractionalIndex,
  NonDeletedExcalidrawElement,
} from "../../element/types";
import * as exportUtils from "../../scene/export";
import {
  diamondFixture,
  ellipseFixture,
  rectangleWithLinkFixture,
  textFixture,
} from "../fixtures/elementFixture";
import { API } from "../helpers/api";
import { FONT_FAMILY, FRAME_STYLE } from "../../constants";
import { prepareElementsForExport } from "../../data";
import { diagramFactory } from "../fixtures/diagramFixture";
import { vi } from "vitest";
import { isCloseTo } from "../../../math";

const DEFAULT_OPTIONS = {
  exportBackground: false,
  viewBackgroundColor: "#ffffff",
};

describe("exportToSvg", () => {
  const ELEMENT_HEIGHT = 100;
  const ELEMENT_WIDTH = 100;
  const ELEMENTS = [
    {
      ...diamondFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a0",
    },
    {
      ...ellipseFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a1",
    },
    {
      ...textFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a2",
    },
    {
      ...textFixture,
      fontFamily: FONT_FAMILY.Nunito, // test embedding external font
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a3",
    },
  ] as NonDeletedExcalidrawElement[];

  it("with default arguments", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
    });

    expect(svgElement).toMatchSnapshot();
  });

  it("with a CJK font", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: [
          ...ELEMENTS,
          {
            ...textFixture,
            height: ELEMENT_HEIGHT,
            width: ELEMENT_WIDTH,
            text: "中国你好！这是一个测试。中国你好！日本こんにちは！これはテストです。한국 안녕하세요! 이것은 테스트입니다.",
            originalText:
              "中国你好！这是一个测试。中国你好！日本こんにちは！これはテストです。한국 안녕하세요! 이것은 테스트입니다.",
            index: "a4" as FractionalIndex,
          } as ExcalidrawTextElement,
        ],
        files: null,
        appState: DEFAULT_OPTIONS,
      },
    });

    expect(svgElement).toMatchSnapshot();
    // extend the timeout, as it needs to first load the fonts from disk and then perform whole woff2 decode, subset and encode (without workers)
  }, 30_000);

  it("with background color", async () => {
    const BACKGROUND_COLOR = "#abcdef";

    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_OPTIONS,
          exportBackground: true,
          viewBackgroundColor: BACKGROUND_COLOR,
        },
        files: null,
      },
    });

    expect(svgElement.querySelector("rect")).toHaveAttribute(
      "fill",
      BACKGROUND_COLOR,
    );
  });

  it("with dark mode", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_OPTIONS,
          exportWithDarkMode: true,
        },
        files: null,
      },
    });

    expect(svgElement.getAttribute("filter")).toMatchInlineSnapshot(`null`);
  });

  it("with exportPadding", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_OPTIONS,
        },
        files: null,
      },
    });

    expect(svgElement).toHaveAttribute("height", ELEMENT_HEIGHT.toString());
    expect(svgElement).toHaveAttribute("width", ELEMENT_WIDTH.toString());
    expect(svgElement).toHaveAttribute(
      "viewBox",
      `0 0 ${ELEMENT_WIDTH} ${ELEMENT_HEIGHT}`,
    );
  });

  it("with scale", async () => {
    const SCALE = 2;

    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_OPTIONS,
        },
        files: null,
      },
      config: {
        scale: SCALE,
      },
    });

    expect(svgElement).toHaveAttribute(
      "height",
      (ELEMENT_HEIGHT * SCALE).toString(),
    );
    expect(svgElement).toHaveAttribute(
      "width",
      (ELEMENT_WIDTH * SCALE).toString(),
    );
  });

  it("with exportEmbedScene", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: ELEMENTS,
        appState: {
          ...DEFAULT_OPTIONS,
          exportEmbedScene: true,
        },
        files: null,
      },
    });
    expect(svgElement.innerHTML).toMatchSnapshot();
  });

  it("with elements that have a link", async () => {
    const svgElement = await exportUtils.exportToSvg({
      data: {
        elements: [rectangleWithLinkFixture],
        files: null,
        appState: DEFAULT_OPTIONS,
      },
    });
    expect(svgElement.innerHTML).toMatchSnapshot();
  });
});

describe("exporting frames", () => {
  const getFrameNameHeight = (exportType: "canvas" | "svg") => {
    const height =
      FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight +
      FRAME_STYLE.nameOffsetY;
    // canvas truncates dimensions to integers
    if (exportType === "canvas") {
      return Math.trunc(height);
    }
    return height;
  };

  // a few tests with exportToCanvas (where we can't inspect elements)
  // ---------------------------------------------------------------------------

  describe("exportToCanvas", () => {
    it("exporting canvas with a single frame shouldn't crop if not exporting frame directly", async () => {
      const elements = [
        API.createElement({
          type: "frame",
          width: 100,
          height: 100,
          x: 0,
          y: 0,
        }),
        API.createElement({
          type: "rectangle",
          width: 100,
          height: 100,
          x: 100,
          y: 0,
        }),
      ];

      const canvas = await exportUtils.exportToCanvas({
        data: {
          elements,
          files: null,
        },
        config: {
          padding: 0,
        },
      });

      expect(canvas.width).toEqual(200);
      expect(canvas.height).toEqual(100 + getFrameNameHeight("canvas"));
    });

    it("exporting canvas with a single frame should crop when exporting frame directly", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const elements = [
        frame,
        API.createElement({
          type: "rectangle",
          width: 100,
          height: 100,
          x: 100,
          y: 0,
        }),
      ];

      const canvas = await exportUtils.exportToCanvas({
        data: {
          elements,
          files: null,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      expect(canvas.width).toEqual(frame.width);
      expect(canvas.height).toEqual(frame.height);
    });
  });

  // exportToSvg (so we can test for element existence)
  // ---------------------------------------------------------------------------
  describe("exportToSvg", () => {
    it("exporting frame should include overlapping elements, but crop to frame", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frameChild = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame.id,
      });
      const rectOverlapping = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 50,
        y: 0,
      });

      const svg = await exportUtils.exportToSvg({
        data: {
          elements: [rectOverlapping, frame, frameChild],
          files: null,
          appState: DEFAULT_OPTIONS,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).toBeNull();
      // frame child is exported
      expect(svg.querySelector(`[data-id="${frameChild.id}"]`)).not.toBeNull();
      // overlapping element is exported
      expect(
        svg.querySelector(`[data-id="${rectOverlapping.id}"]`),
      ).not.toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(frame.height.toString());
    });

    it("should filter non-overlapping elements when exporting a frame", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frameChild = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame.id,
      });
      const elementOutside = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const svg = await exportUtils.exportToSvg({
        data: {
          elements: [frameChild, frame, elementOutside],
          files: null,
          appState: DEFAULT_OPTIONS,
        },
        config: {
          padding: 0,
          exportingFrame: frame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).toBeNull();
      // frame child is exported
      expect(svg.querySelector(`[data-id="${frameChild.id}"]`)).not.toBeNull();
      // non-overlapping element is not exported
      expect(svg.querySelector(`[data-id="${elementOutside.id}"]`)).toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(frame.height.toString());
    });

    it("should export multiple frames when selected, excluding overlapping elements", async () => {
      const frame1 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frame2 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const frame1Child = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame1.id,
      });
      const frame2Child = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
        frameId: frame2.id,
      });
      const frame2Overlapping = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
        x: 350,
        y: 0,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame1Child, frame1, frame2Child, frame2, frame2Overlapping],
        {
          selectedElementIds: { [frame1.id]: true, [frame2.id]: true },
        },
        true,
      );

      const svg = await exportUtils.exportToSvg({
        data: {
          elements: exportedElements,
          files: null,
          appState: DEFAULT_OPTIONS,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frames themselves should be exported when multiple frames selected
      expect(svg.querySelector(`[data-id="${frame1.id}"]`)).not.toBeNull();
      expect(svg.querySelector(`[data-id="${frame2.id}"]`)).not.toBeNull();
      // children should be epxorted
      expect(svg.querySelector(`[data-id="${frame1Child.id}"]`)).not.toBeNull();
      expect(svg.querySelector(`[data-id="${frame2Child.id}"]`)).not.toBeNull();
      // overlapping elements or non-overlapping elements should not be exported
      expect(
        svg.querySelector(`[data-id="${frame2Overlapping.id}"]`),
      ).toBeNull();

      expect(svg.getAttribute("width")).toBe(
        (frame2.x + frame2.width).toString(),
      );
      expect(svg.getAttribute("height")).toBe(
        (frame2.y + frame2.height + getFrameNameHeight("svg")).toString(),
      );
    });

    it("should render frame alone when not selected", async () => {
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame],
        {
          selectedElementIds: {},
        },
        false,
      );

      const svg = await exportUtils.exportToSvg({
        data: {
          elements: exportedElements,
          files: null,
          appState: DEFAULT_OPTIONS,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frame itself isn't exported
      expect(svg.querySelector(`[data-id="${frame.id}"]`)).not.toBeNull();

      expect(svg.getAttribute("width")).toBe(frame.width.toString());
      expect(svg.getAttribute("height")).toBe(
        (frame.height + getFrameNameHeight("svg")).toString(),
      );
    });

    it("should not export frame-overlapping elements belonging to different frame", async () => {
      const frame1 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      });
      const frame2 = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
        x: 200,
        y: 0,
      });

      const frame1Child = API.createElement({
        type: "rectangle",
        width: 150,
        height: 100,
        x: 0,
        y: 50,
        frameId: frame1.id,
      });
      const frame2Child = API.createElement({
        type: "rectangle",
        width: 150,
        height: 100,
        x: 50,
        y: 0,
        frameId: frame2.id,
      });

      // low-level exportToSvg api expects elements to be pre-filtered, so let's
      // use the filter we use in the editor
      const { exportedElements, exportingFrame } = prepareElementsForExport(
        [frame1Child, frame1, frame2Child, frame2],
        {
          selectedElementIds: { [frame1.id]: true },
        },
        true,
      );

      const svg = await exportUtils.exportToSvg({
        data: {
          elements: exportedElements,
          files: null,
          appState: DEFAULT_OPTIONS,
        },
        config: {
          padding: 0,
          exportingFrame,
        },
      });

      // frame shouldn't be exported
      expect(svg.querySelector(`[data-id="${frame1.id}"]`)).toBeNull();
      // frame1 child should be epxorted
      expect(svg.querySelector(`[data-id="${frame1Child.id}"]`)).not.toBeNull();
      // frame2 child should not be exported even if it physically overlaps with
      // frame1
      expect(svg.querySelector(`[data-id="${frame2Child.id}"]`)).toBeNull();

      expect(svg.getAttribute("width")).toBe(frame1.width.toString());
      expect(svg.getAttribute("height")).toBe(frame1.height.toString());
    });
  });
});

describe("exportToBlob", async () => {
  describe("mime type", () => {
    it("should change image/jpg to image/jpeg", async () => {
      const blob = await exportUtils.exportToBlob({
        data: {
          ...diagramFactory(),

          appState: {
            exportBackground: true,
          },
        },
        config: {
          getDimensions: (width, height) => ({ width, height, scale: 1 }),
          // testing typo in MIME type (jpg → jpeg)
          mimeType: "image/jpg",
        },
      });
      expect(blob?.type).toBe(exportUtils.MIME_TYPES.jpg);
    });
    it("should default to image/png", async () => {
      const blob = await exportUtils.exportToBlob({
        data: diagramFactory(),
      });
      expect(blob?.type).toBe(exportUtils.MIME_TYPES.png);
    });

    it("should warn when using quality with image/png", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      await exportUtils.exportToBlob({
        data: diagramFactory(),
        config: {
          mimeType: exportUtils.MIME_TYPES.png,
          quality: 1,
        },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        `"quality" will be ignored for "${exportUtils.MIME_TYPES.png}" mimeType`,
      );
    });
  });
});

describe("updated API", () => {
  // set up
  // a random set of elements
  const ELEMENT_HEIGHT = 100;
  const ELEMENT_WIDTH = 100;
  const POSITION = 1000;
  const getRandomPos = () => {
    const randomNum = () =>
      Math.round((Math.random() < 0.5 ? 1 : -1) * Math.random() * POSITION);
    return { x: randomNum(), y: randomNum() };
  };
  const ELEMENTS = [
    {
      ...diamondFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a0",
      ...getRandomPos(),
    },
    {
      ...ellipseFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a1",
      ...getRandomPos(),
    },
    {
      ...textFixture,
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a2",
      ...getRandomPos(),
    },
    {
      ...textFixture,
      fontFamily: FONT_FAMILY.Nunito, // test embedding external font
      height: ELEMENT_HEIGHT,
      width: ELEMENT_WIDTH,
      index: "a3",
      ...getRandomPos(),
    },
  ] as NonDeletedExcalidrawElement[];

  // entire canvas
  describe("exporting the entire canvas", () => {
    const [, , canvasWidth, canvasHeight] = exportUtils.getCanvasSize(ELEMENTS);

    it("fit = none, no padding", async () => {
      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config: {
          fit: "none",
        },
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(canvasWidth, 1);
      expect(canvas.height).toBeCloseTo(canvasHeight, 1);
    });

    it("fit = contain, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config: {
          fit: "contain",
        },
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(isCloseTo(canvas.width, canvasWidth, 1)).toBe(true);
      expect(isCloseTo(canvas.height, canvasHeight, 1)).toBe(true);
    });

    it("fit = none, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        padding: PADDING,
      };
      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(canvasWidth + PADDING * 2);
      expect(canvas.height).toBeCloseTo(canvasHeight + PADDING * 2);
    });

    it("fit = contain, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        padding: PADDING,
      };
      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
    });
  });

  // specified dimensions (w x h)
  describe("exporting with specified dimensions", () => {
    const dimension = {
      width: 200,
      height: 200,
    };

    it("fit = none, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        ...dimension,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(dimension.width, 1);
      expect(canvas.height).toBeCloseTo(dimension.height, 1);
    });

    it("fit = contain, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        ...dimension,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(dimension.width, 1);
      expect(canvas.height).toBeCloseTo(dimension.height, 1);
    });

    it("fit = none, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        padding: PADDING,
        ...dimension,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(dimension.width + PADDING * 2, 1);
      expect(canvas.height).toBeCloseTo(dimension.height + PADDING * 2, 1);
    });

    it("fit = contain, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        padding: PADDING,
        ...dimension,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);

      expect(isCloseTo(canvas.width, dimension.width, 1)).toBe(true);
      expect(isCloseTo(canvas.height, dimension.height, 1)).toBe(true);
    });
  });

  // specified maxWH
  describe("exporting with specified maxWidthOrHeight", () => {
    const maxWH = 200;

    it("fit = none, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        maxWidthOrHeight: maxWH,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(canvas.width).toBeLessThanOrEqual(maxWH);
      expect(canvas.height).toBeLessThanOrEqual(maxWH);
    });

    it("fit = contain, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        maxWidthOrHeight: maxWH,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(canvas.width).toBeLessThanOrEqual(maxWH);
      expect(canvas.height).toBeLessThanOrEqual(maxWH);
    });

    it("fit = none, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        padding: PADDING,
        maxWidthOrHeight: maxWH,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);

      expect(canvas.width).toBeLessThanOrEqual(maxWH);
      expect(canvas.height).toBeLessThanOrEqual(maxWH);
    });

    it("fit = contain, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        padding: PADDING,
        maxWidthOrHeight: maxWH,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);

      expect(canvas.width).toBeLessThanOrEqual(maxWH);
      expect(canvas.height).toBeLessThanOrEqual(maxWH);
    });
  });

  // specified widthOrHeight
  describe("exporting with specified widthOrHeight", () => {
    const widthOrHeight = 200;

    it("fit = none, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        widthOrHeight,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(canvas.width, widthOrHeight, 1) ||
          isCloseTo(canvas.height, widthOrHeight, 1),
      ).toBe(true);
    });

    it("fit = contain, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        widthOrHeight,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);

      expect(
        isCloseTo(canvas.width, widthOrHeight, 1) ||
          isCloseTo(canvas.height, widthOrHeight, 1),
      ).toBe(true);
    });

    it("fit = none, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        padding: PADDING,
        widthOrHeight,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(canvas.width, widthOrHeight, 1) ||
          isCloseTo(canvas.height, widthOrHeight, 1),
      ).toBe(true);
    });

    it("fit = contain, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "contain",
        padding: PADDING,
        widthOrHeight,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(canvas.width, widthOrHeight, 1) ||
          isCloseTo(canvas.height, widthOrHeight, 1),
      ).toBe(true);
    });
  });

  // specified position
  describe("exporting with specified position", () => {
    const [, , canvasWidth, canvasHeight] = exportUtils.getCanvasSize(ELEMENTS);
    const position = { x: 100, y: 100 };

    it("fit = none, no padding", async () => {
      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        ...position,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("width") ?? ""),
          canvas.width,
          1,
        ),
      ).toBe(true);
      expect(
        isCloseTo(
          parseFloat(svgElement.getAttribute("height") ?? ""),
          canvas.height,
          1,
        ),
      ).toBe(true);
      expect(canvas.width).toBeCloseTo(canvasWidth, 1);
      expect(canvas.height).toBeCloseTo(canvasHeight, 1);
    });

    it("fit = none, with padding", async () => {
      const PADDING = Math.round(Math.random() * 100);

      const config: exportUtils.ExportSceneConfig = {
        fit: "none",
        padding: PADDING,
        ...position,
      };

      const svgElement = await exportUtils.exportToSvg({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      const canvas = await exportUtils.exportToCanvas({
        data: { elements: ELEMENTS, appState: DEFAULT_OPTIONS, files: null },
        config,
      });

      expect(svgElement.getAttribute("width")).toBeCloseTo(canvas.width);
      expect(svgElement.getAttribute("height")).toBeCloseTo(canvas.height);
      expect(canvas.width).toBeCloseTo(canvasWidth + PADDING * 2);
      expect(canvas.height).toBeCloseTo(canvasHeight + PADDING * 2);
    });
  });
});
