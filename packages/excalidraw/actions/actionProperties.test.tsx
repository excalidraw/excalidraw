import { queryByTestId } from "@testing-library/react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  FONT_FAMILY,
  STROKE_WIDTH,
} from "@excalidraw/common";
import {
  CORE_FRAME_SCHEMA_TRACK,
  CORE_SUPPORTED_TRACKS,
} from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionChangeBackgroundColor,
  actionChangeRoundness,
  actionChangeStrokeWidth,
} from "./actionProperties";

const { h } = window;

describe("element locking", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("properties when tool selected", () => {
    it("should show active background top picks", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
      });
      const activeColor = queryByTestId(
        document.body,
        `color-top-pick-${color}`,
      );
      expect(activeColor).toHaveClass("active");
    });

    it("should show fill style when background non-transparent", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toHaveClass("active");
      API.setAppState({
        currentItemFillStyle: "solid",
      });
      const solidFillStyle = queryByTestId(document.body, `fill-solid`);
      expect(solidFillStyle).toHaveClass("active");
    });

    it("should not show fill style when background transparent", () => {
      UI.clickTool("rectangle");

      API.setAppState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toBe(null);
    });

    it("should show horizontal text align for text tool", () => {
      UI.clickTool("text");

      API.setAppState({
        currentItemTextAlign: "right",
      });

      const centerTextAlign = queryByTestId(document.body, `align-right`);
      expect(centerTextAlign).toBeChecked();
    });
  });

  describe("properties when elements selected", () => {
    it("should show active styles when single element selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toHaveClass("active");
    });

    it("should not show fill style selected element's background is transparent", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: COLOR_PALETTE.transparent,
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toBe(null);
    });

    it("should show background color picker for selected frame", () => {
      const frame = API.createElement({
        type: "frame",
      });
      API.setElements([frame]);
      API.setSelectedElements([frame]);

      expect(
        queryByTestId(
          document.body,
          `color-top-pick-${DEFAULT_ELEMENT_BACKGROUND_PICKS[0]}`,
        ),
      ).not.toBe(null);
    });

    it("should highlight common stroke width of selected elements", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      const thinStrokeWidthButton = queryByTestId(
        document.body,
        `strokeWidth-thin`,
      );
      expect(thinStrokeWidthButton).toBeChecked();
    });

    it("should not highlight any stroke width button if no common style", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.bold,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(queryByTestId(document.body, `strokeWidth-thin`)).not.toBe(null);
      expect(
        queryByTestId(document.body, `strokeWidth-thin`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-bold`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-extraBold`),
      ).not.toBeChecked();
    });

    it("should show properties of different element types when selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.bold,
      });
      const text = API.createElement({
        type: "text",
        fontFamily: FONT_FAMILY["Comic Shanns"],
      });
      API.setElements([rect, text]);
      API.setSelectedElements([rect, text]);

      expect(queryByTestId(document.body, `strokeWidth-bold`)).toBeChecked();
      expect(queryByTestId(document.body, `font-family-code`)).toHaveClass(
        "active",
      );
    });

    it("should not update text background when changing background in mixed frame selection", () => {
      const frame = API.createElement({
        type: "frame",
        schemaState: { tracks: {} },
      });
      const text = API.createElement({
        type: "text",
        backgroundColor: COLOR_PALETTE.transparent,
      });
      API.setElements([text, frame]);
      API.setSelectedElements([text, frame]);

      act(() => {
        h.app.actionManager.executeAction(actionChangeBackgroundColor, "ui", {
          viewBackgroundColor: h.state.viewBackgroundColor,
          currentItemBackgroundColor: "#ffc9c9",
        });
      });

      expect(API.getElement(frame).backgroundColor).toBe("#ffc9c9");
      expect(API.getElement(text).backgroundColor).toBe(
        COLOR_PALETTE.transparent,
      );
      expect(
        API.getElement(frame).schemaState.tracks[CORE_FRAME_SCHEMA_TRACK],
      ).toBe(CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK]);
    });

    it("should not update frame stroke width when changing stroke width in mixed selection", () => {
      const frame = API.createElement({
        type: "frame",
      });
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      API.setElements([rect, frame]);
      API.setSelectedElements([rect, frame]);

      const originalFrameStrokeWidth = API.getElement(frame).strokeWidth;

      act(() => {
        h.app.actionManager.executeAction(
          actionChangeStrokeWidth,
          "ui",
          STROKE_WIDTH.extraBold,
        );
      });

      expect(API.getElement(rect).strokeWidth).toBe(STROKE_WIDTH.extraBold);
      expect(API.getElement(frame).strokeWidth).toBe(originalFrameStrokeWidth);
    });

    it("should not update frame roundness when changing roundness in mixed selection", () => {
      const frame = API.createElement({
        type: "frame",
      });
      const rect = API.createElement({
        type: "rectangle",
        roundness: null,
      });
      API.setElements([rect, frame]);
      API.setSelectedElements([rect, frame]);

      act(() => {
        h.app.actionManager.executeAction(actionChangeRoundness, "ui", "round");
      });

      expect(API.getElement(rect).roundness).not.toBe(null);
      expect(API.getElement(frame).roundness).toBe(null);
    });
  });
});
