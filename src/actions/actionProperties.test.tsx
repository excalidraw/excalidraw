import { Excalidraw } from "../packages/excalidraw/index";
import { queryByTestId } from "@testing-library/react";
import { render } from "../tests/test-utils";
import { UI } from "../tests/helpers/ui";
import { API } from "../tests/helpers/api";
import { COLOR_PALETTE, DEFAULT_ELEMENT_BACKGROUND_PICKS } from "../colors";
import { FONT_FAMILY, STROKE_WIDTH } from "../constants";

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

      h.setState({
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

      h.setState({
        currentItemBackgroundColor: color,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toHaveClass("active");
      h.setState({
        currentItemFillStyle: "solid",
      });
      const solidFillStyle = queryByTestId(document.body, `fill-solid`);
      expect(solidFillStyle).toHaveClass("active");
    });

    it("should not show fill style when background transparent", () => {
      UI.clickTool("rectangle");

      h.setState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toBe(null);
    });

    it("should show horizontal text align for text tool", () => {
      UI.clickTool("text");

      h.setState({
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
      h.elements = [rect];
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
      h.elements = [rect];
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
      h.elements = [rect1, rect2];
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
      h.elements = [rect1, rect2];
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
        fontFamily: FONT_FAMILY.Cascadia,
      });
      h.elements = [rect, text];
      API.setSelectedElements([rect, text]);

      expect(queryByTestId(document.body, `strokeWidth-bold`)).toBeChecked();
      expect(queryByTestId(document.body, `font-family-code`)).toBeChecked();
    });
  });
});
