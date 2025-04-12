import { exportToCanvas, exportToSvg } from "@excalidraw/utils";

import { FONT_FAMILY, FRAME_STYLE } from "@excalidraw/common";

import type {
  ExcalidrawTextElement,
  FractionalIndex,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { prepareElementsForExport } from "../../data";
import * as exportUtils from "../../scene/export";
import {
  diamondFixture,
  ellipseFixture,
  rectangleWithLinkFixture,
  textFixture,
} from "../fixtures/elementFixture";
import { API } from "../helpers/api";

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

  const DEFAULT_OPTIONS = {
    exportBackground: false,
    viewBackgroundColor: "#ffffff",
    files: {},
  };

  it("with default arguments", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      DEFAULT_OPTIONS,
      null,
    );

    expect(svgElement).toMatchSnapshot();
  });

  it("with a CJK font", async () => {
    const svgElement = await exportUtils.exportToSvg(
      [
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
      DEFAULT_OPTIONS,
      null,
    );

    expect(svgElement).toMatchSnapshot();
    // extend the timeout, as it needs to first load the fonts from disk and then perform whole woff2 decode, subset and encode (without workers)
  }, 30_000);

  it("with background color", async () => {
    const BACKGROUND_COLOR = "#abcdef";

    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportBackground: true,
        viewBackgroundColor: BACKGROUND_COLOR,
      },
      null,
    );

    expect(svgElement.querySelector("rect")).toHaveAttribute(
      "fill",
      BACKGROUND_COLOR,
    );
  });

  it("with dark mode", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportWithDarkMode: true,
      },
      null,
    );

    expect(svgElement.getAttribute("filter")).toMatchInlineSnapshot(
      `"invert(93%) hue-rotate(180deg)"`,
    );
  });

  it("with exportPadding", async () => {
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportPadding: 0,
      },
      null,
    );

    expect(svgElement).toHaveAttribute("height", ELEMENT_HEIGHT.toString());
    expect(svgElement).toHaveAttribute("width", ELEMENT_WIDTH.toString());
    expect(svgElement).toHaveAttribute(
      "viewBox",
      `0 0 ${ELEMENT_WIDTH} ${ELEMENT_HEIGHT}`,
    );
  });

  it("with scale", async () => {
    const SCALE = 2;

    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportPadding: 0,
        exportScale: SCALE,
      },
      null,
    );

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
    const svgElement = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...DEFAULT_OPTIONS,
        exportEmbedScene: true,
      },
      null,
    );
    expect(svgElement.innerHTML).toMatchSnapshot();
  });

  it("with elements that have a link", async () => {
    const svgElement = await exportUtils.exportToSvg(
      [rectangleWithLinkFixture],
      DEFAULT_OPTIONS,
      null,
    );
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

      const canvas = await exportToCanvas({
        elements,
        files: null,
        exportPadding: 0,
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

      const canvas = await exportToCanvas({
        elements,
        files: null,
        exportPadding: 0,
        exportingFrame: frame,
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

      const svg = await exportToSvg({
        elements: [rectOverlapping, frame, frameChild],
        files: null,
        exportPadding: 0,
        exportingFrame: frame,
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

      const svg = await exportToSvg({
        elements: [frameChild, frame, elementOutside],
        files: null,
        exportPadding: 0,
        exportingFrame: frame,
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

      const svg = await exportToSvg({
        elements: exportedElements,
        files: null,
        exportPadding: 0,
        exportingFrame,
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

      const svg = await exportToSvg({
        elements: exportedElements,
        files: null,
        exportPadding: 0,
        exportingFrame,
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

      const svg = await exportToSvg({
        elements: exportedElements,
        files: null,
        exportPadding: 0,
        exportingFrame,
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
