import { queryByTestId } from "@testing-library/react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  FONT_FAMILY,
  STROKE_WIDTH,
} from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";
import { getDiamondPoints } from "../../element/src/bounds";
import { ROUNDNESS } from "../../common/src/constants";

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
  });
});

describe("element roundness", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  const roundnessConfig = {
    type: ROUNDNESS.CUSTOMIZED,
    value: 4,
    corners: {
      topLeft: 32,
      topRight: 32,
      bottomLeft: 32,
      bottomRight: 32
    }
  } 
    
  describe("corner values of rectangle", () => { 
    it("should not have negative values", () => {
      const rect = API.createElement({
        type: "rectangle",
        roundness: roundnessConfig,
      });

      expect(rect.roundness?.corners?.bottomLeft).toBeGreaterThanOrEqual(0);
      expect(rect.roundness?.corners?.topLeft).toBeGreaterThanOrEqual(0);
      expect(rect.roundness?.corners?.bottomRight).toBeGreaterThanOrEqual(0);
      expect(rect.roundness?.corners?.topRight).toBeGreaterThanOrEqual(0);
    });

    it("should not be greater than half the minimum length of the width or height", () => {
      const rect = API.createElement({
        type: "rectangle",
        roundness: roundnessConfig,
        width: 100,
        height: 100,
      });

      const halfMinLength = 0.5 * Math.min(rect.width, rect.height);

      expect(rect.roundness?.corners?.bottomLeft).not.toBeGreaterThan(halfMinLength);
      expect(rect.roundness?.corners?.topLeft).not.toBeGreaterThanOrEqual(halfMinLength);
      expect(rect.roundness?.corners?.bottomRight).not.toBeGreaterThanOrEqual(halfMinLength);
      expect(rect.roundness?.corners?.topRight).not.toBeGreaterThanOrEqual(halfMinLength);
    });
  });

  describe("corner values of diamond", () => {
    it("should not have negative values", () => {
      const diamond = API.createElement({
        type: "diamond",
        // roundness: roundnessConfig,
      });

      expect(diamond.roundness?.corners?.bottomLeft).toBeGreaterThanOrEqual(0);
      expect(diamond.roundness?.corners?.topLeft).toBeGreaterThanOrEqual(0);
      expect(diamond.roundness?.corners?.bottomRight).toBeGreaterThanOrEqual(0);
      expect(diamond.roundness?.corners?.topRight).toBeGreaterThanOrEqual(0);
    });

    it("should not be greater than half the minimum length of the width or height", () => {
      const diamond = API.createElement({
        type: "diamond",
        roundness: roundnessConfig,
      });

      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] = getDiamondPoints(diamond);

      if (diamond.roundness?.type === ROUNDNESS.CUSTOMIZED && diamond.roundness) {
        const corners = diamond.roundness?.corners;
        const T = { x: topX,    y: topY };
        const R = { x: rightX,  y: rightY };
        const B = { x: bottomX, y: bottomY };
        const L = { x: leftX,   y: leftY };
        const move = (p0: {x:number;y:number}, p1: {x:number;y:number}, d: number) => {
          const vx = p1.x - p0.x, vy = p1.y - p0.y;
          const len = Math.hypot(vx, vy);
          const t = d / len;
          return { x: p0.x + vx * t, y: p0.y + vy * t };
        };
      }
      
      const halfMinimumLength = Math.hypot(rightX - topX, rightY - topY) / 2
      expect(diamond.roundness?.corners?.bottomLeft).not.toBeGreaterThan(halfMinimumLength);
      expect(diamond.roundness?.corners?.topLeft).toBeGreaterThanOrEqual(halfMinimumLength);
      expect(diamond.roundness?.corners?.bottomRight).toBeGreaterThanOrEqual(halfMinimumLength);
      expect(diamond.roundness?.corners?.topRight).toBeGreaterThanOrEqual(halfMinimumLength);
    });
  });
});
