import { fireEvent, queryByTestId } from "@testing-library/react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  FREEDRAW_STROKE_WIDTH,
  FONT_FAMILY,
  STROKE_WIDTH,
  ROUNDNESS,
  ROUNDNESS_SLIDER_MAX_RATIO,
} from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

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

    it("should not show fill style for sticky note tool", () => {
      UI.clickTool("stickynote");

      API.setAppState({
        currentItemBackgroundColor: DEFAULT_ELEMENT_BACKGROUND_PICKS[1],
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

    it("should not show fill style for selected sticky note", () => {
      const stickyNote = API.createElement({
        type: "stickynote",
        backgroundColor: DEFAULT_ELEMENT_BACKGROUND_PICKS[1],
        fillStyle: "hachure",
      });
      API.setElements([stickyNote]);
      API.setSelectedElements([stickyNote]);

      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);
      expect(hachureFillButton).toBe(null);
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

    it("should highlight common stroke width key across freedraw and non-freedraw elements", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      const freedraw = API.createElement({
        type: "freedraw",
        strokeWidth: FREEDRAW_STROKE_WIDTH.medium,
      });
      API.setElements([rect, freedraw]);
      API.setSelectedElements([rect, freedraw]);

      expect(queryByTestId(document.body, `strokeWidth-medium`)).toBeChecked();
    });

    it("should apply stroke width by element type", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const freedraw = API.createElement({
        type: "freedraw",
        strokeWidth: FREEDRAW_STROKE_WIDTH.thin,
      });
      API.setElements([rect, freedraw]);
      API.setSelectedElements([rect, freedraw]);

      const boldStrokeWidthButton = queryByTestId(
        document.body,
        `strokeWidth-bold`,
      );
      expect(boldStrokeWidthButton).not.toBe(null);
      fireEvent.click(boldStrokeWidthButton!);

      const selectedElements = API.getSelectedElements();
      const selectedRect = selectedElements.find(
        (element) => element.type === "rectangle",
      );
      const selectedFreedraw = selectedElements.find(
        (element) => element.type === "freedraw",
      );

      expect(selectedRect?.strokeWidth).toBe(STROKE_WIDTH.bold);
      expect(selectedFreedraw?.strokeWidth).toBe(FREEDRAW_STROKE_WIDTH.bold);
    });

    it("should create new elements with stroke width by element type", () => {
      API.setAppState({ currentItemStrokeWidthKey: "bold" });

      const rect = API.createElement({ type: "rectangle" });
      const freedraw = API.createElement({ type: "freedraw" });

      expect(rect.strokeWidth).toBe(STROKE_WIDTH.bold);
      expect(freedraw.strokeWidth).toBe(FREEDRAW_STROKE_WIDTH.bold);
    });

    it("should not highlight any stroke width button if no common style", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(queryByTestId(document.body, `strokeWidth-thin`)).not.toBe(null);
      expect(
        queryByTestId(document.body, `strokeWidth-thin`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-medium`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-bold`),
      ).not.toBeChecked();
    });

    it("should show properties of different element types when selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.medium,
      });
      const text = API.createElement({
        type: "text",
        fontFamily: FONT_FAMILY["Comic Shanns"],
      });
      API.setElements([rect, text]);
      API.setSelectedElements([rect, text]);

      expect(queryByTestId(document.body, `strokeWidth-medium`)).toBeChecked();
      expect(queryByTestId(document.body, `font-family-code`)).toHaveClass(
        "active",
      );
    });
  });
});

describe("roundness amount", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("is only shown for round adaptive-radius elements", () => {
    const sharpRect = API.createElement({ type: "rectangle", roundness: null });
    API.setElements([sharpRect]);
    API.setSelectedElements([sharpRect]);
    expect(queryByTestId(document.body, "roundnessAmount")).toBe(null);

    const roundDiamond = API.createElement({
      type: "diamond",
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });
    API.setElements([roundDiamond]);
    API.setSelectedElements([roundDiamond]);
    expect(queryByTestId(document.body, "roundnessAmount")).toBe(null);

    const roundRect = API.createElement({
      type: "rectangle",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setElements([roundRect]);
    API.setSelectedElements([roundRect]);
    expect(queryByTestId(document.body, "roundnessAmount")).not.toBe(null);
  });

  it("reflects the element's current radius as a percent of the max", () => {
    const maxRadius = (100 / 2) * ROUNDNESS_SLIDER_MAX_RATIO;
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setElements([rect]);
    // API.createElement only accepts a round/sharp boolean for roundness, so
    // the custom radius has to be applied as a follow-up mutation
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: maxRadius / 2 },
    });
    API.setSelectedElements([rect]);

    const slider = queryByTestId(document.body, "roundnessAmount");
    expect(slider).toHaveValue("50");
  });

  it("updates the radius, clamped short of a full pill, when dragged to the max", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 200,
      height: 200,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    const slider = queryByTestId(document.body, "roundnessAmount")!;
    fireEvent.change(slider, { target: { value: "100" } });

    const updated = API.getSelectedElements()[0];
    expect(updated.roundness?.value).toBe(
      (200 / 2) * ROUNDNESS_SLIDER_MAX_RATIO,
    );
  });
});
