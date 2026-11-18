import { fireEvent, queryByTestId } from "@testing-library/react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  FREEDRAW_STROKE_WIDTH,
  FONT_FAMILY,
  KEYS,
  STROKE_WIDTH,
} from "@excalidraw/common";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionChangeRoundness,
  actionChangeStrokeWidth,
} from "./actionProperties";

const { h } = window;
const mouse = new Pointer("mouse");

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

describe("arrows bound to a shape whose outline changes", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const setup = () => {
    const rectangle = API.createElement({
      type: "rectangle",
      id: "rectangle",
      x: 300,
      y: 0,
      width: 200,
      height: 100,
      strokeWidth: STROKE_WIDTH.thin,
      roundness: null,
    });
    API.setElements([rectangle]);

    // ends just outside the left edge near the top-left corner, so both
    // the binding gap and the rounded corner move it
    UI.clickTool("arrow");
    mouse.reset();
    mouse.downAt(0, 8);
    mouse.moveTo(150, 8);
    mouse.moveTo(296, 8);
    mouse.up();

    const arrow = h.elements.find(
      (el) => el.type === "arrow",
    ) as ExcalidrawArrowElement;
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    API.setSelectedElements([rectangle]);

    return arrow.id;
  };

  const getArrowEnd = (arrowId: string) => {
    const arrow = h.elements.find(
      (el) => el.id === arrowId,
    ) as ExcalidrawArrowElement;
    const [x, y] = arrow.points[arrow.points.length - 1];
    return [arrow.x + x, arrow.y + y];
  };

  // nudging the shape re-routes its arrows from scratch
  const getRoutedArrowEnd = (arrowId: string) => {
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    Keyboard.keyPress(KEYS.ARROW_LEFT);
    return getArrowEnd(arrowId);
  };

  it("re-routes a bound arrow when changing the stroke width", () => {
    const arrowId = setup();

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeWidth, "ui", "bold");
    });

    const end = getArrowEnd(arrowId);
    expect(end).toEqual(getRoutedArrowEnd(arrowId));
  });

  it("re-routes a bound arrow when changing the roundness", () => {
    const arrowId = setup();

    act(() => {
      h.app.actionManager.executeAction(actionChangeRoundness, "ui", "round");
    });

    const end = getArrowEnd(arrowId);
    expect(end).toEqual(getRoutedArrowEnd(arrowId));
  });
});
