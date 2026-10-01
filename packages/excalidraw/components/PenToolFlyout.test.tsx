import { fireEvent, queryByTestId } from "@testing-library/react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getNormalizedZoom } from "../scene";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import { penSizeFromSlider } from "./penSize";

const { h } = window;

const flyout = () => queryByTestId(document.body, "pen-size-flyout");

const slider = (within: HTMLElement | null = document.body) =>
  within?.querySelector<HTMLInputElement>('[data-testid="pen-size-slider"]') ??
  null;

const presets = () => queryByTestId(document.body, "strokeWidth-thin");

const slideTo = (
  position: number,
  within: HTMLElement | null = document.body,
) => {
  const input = slider(within);
  if (!input) {
    throw new Error("no pen-size slider");
  }
  fireEvent.change(input, { target: { value: String(position) } });
};

const drawStroke = () =>
  UI.createElement("freedraw", { x: 0, y: 0, width: 10, height: 10 })
    .strokeWidth;

describe("PenToolFlyout", () => {
  afterEach(async () => {
    await act(async () => {});
  });

  describe("when the editor renders without a host pen width", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    describe("when the pen tool is picked from the toolbar", () => {
      beforeEach(() => {
        UI.clickTool("freedraw");
      });

      it("opens the pen-size flyout", () => {
        expect(flyout()).not.toBeNull();
      });

      it("puts the slider in the flyout", () => {
        expect(slider(flyout())).not.toBeNull();
      });

      it("shows no stroke-width presets", () => {
        expect(presets()).toBeNull();
      });

      describe("when the active pen button is clicked again", () => {
        beforeEach(() => {
          UI.clickTool("freedraw");
        });

        it("closes the flyout", () => {
          expect(flyout()).toBeNull();
        });
      });

      describe("when the slider is dragged to a mid width", () => {
        let previewWidth: string | undefined;

        beforeEach(() => {
          slideTo(80, flyout());
          previewWidth = flyout()?.querySelector<HTMLElement>(
            '[data-testid="pen-size-preview"]',
          )?.style.width;
        });

        it("sizes the preview dot to the stroke the pen will draw", () => {
          expect(previewWidth).toBe(`${penSizeFromSlider(80) * 2 * 1.4}px`);
        });
      });

      describe("when the slider is dragged to a thick width", () => {
        let width: number;

        beforeEach(() => {
          slideTo(90, flyout());
          width = drawStroke();
        });

        it("draws the next stroke at that width", () => {
          expect(width).toBeCloseTo(penSizeFromSlider(90), 12);
        });
      });

      describe("when the slider is dragged and the user switches tools and back", () => {
        let width: number;

        beforeEach(() => {
          slideTo(20, flyout());
          UI.clickTool("rectangle");
          UI.clickTool("freedraw");
          width = drawStroke();
        });

        it("keeps the pen width", () => {
          expect(width).toBeCloseTo(penSizeFromSlider(20), 12);
        });
      });
    });

    describe("when the rectangle tool is picked", () => {
      beforeEach(() => {
        UI.clickTool("rectangle");
      });

      it("keeps the stroke-width presets", () => {
        expect(presets()).not.toBeNull();
      });

      it("shows no pen-size slider", () => {
        expect(slider()).toBeNull();
      });
    });

    describe("when freedraw strokes are selected", () => {
      let strokes: NonDeletedExcalidrawElement[];

      beforeEach(() => {
        strokes = [
          API.createElement({ type: "freedraw", strokeWidth: 0.25 }),
          API.createElement({ type: "freedraw", strokeWidth: 0.5 }),
        ];
        API.setElements(strokes);
        API.setSelectedElements(strokes);
      });

      describe("when the slider in the properties panel is dragged", () => {
        let widths: number[];

        beforeEach(() => {
          slideTo(75);
          widths = h.elements.map((element) => element.strokeWidth);
        });

        it("sets every selected stroke to the new width", () => {
          expect(widths).toEqual([
            penSizeFromSlider(75),
            penSizeFromSlider(75),
          ]);
        });
      });
    });

    describe("when a stroke and a rectangle are selected together", () => {
      beforeEach(() => {
        const elements = [
          API.createElement({ type: "freedraw", strokeWidth: 0.25 }),
          API.createElement({ type: "rectangle", strokeWidth: 2 }),
        ];
        API.setElements(elements);
        API.setSelectedElements(elements);
      });

      describe("when the slider is dragged", () => {
        let rectangleWidth: number;

        beforeEach(() => {
          slideTo(75);
          rectangleWidth = h.elements[1].strokeWidth;
        });

        it("leaves the rectangle's width alone", () => {
          expect(rectangleWidth).toBe(2);
        });
      });
    });
  });

  describe("when the editor authors in screen units at 200% zoom", () => {
    beforeEach(async () => {
      await render(<Excalidraw authoringUnits="screen" />);
      API.setAppState({ zoom: { value: getNormalizedZoom(2) } });
      UI.clickTool("freedraw");
    });

    describe("when the slider is dragged", () => {
      let width: number;

      beforeEach(() => {
        slideTo(60, flyout());
        width = drawStroke();
      });

      it("halves the scene width so the stroke reads the same on screen", () => {
        expect(width).toBeCloseTo(penSizeFromSlider(60) / 2, 12);
      });
    });
  });

  describe("when a stroke is selected while authoring in screen units", () => {
    beforeEach(async () => {
      await render(<Excalidraw authoringUnits="screen" />);
      const stroke = API.createElement({ type: "freedraw", strokeWidth: 0.5 });
      API.setElements([stroke]);
      API.setSelectedElements([stroke]);
    });

    describe("when the user zooms to 200%", () => {
      let label: string | null | undefined;

      beforeEach(() => {
        API.setAppState({ zoom: { value: getNormalizedZoom(2) } });
        label = document.querySelector(".pen-size-slider__value")?.textContent;
      });

      it("shows the stroke's on-screen width at the new zoom", () => {
        expect(label).toBe("1");
      });
    });
  });

  describe("when the host sets the pen width", () => {
    beforeEach(async () => {
      await render(<Excalidraw freedrawStrokeWidth={3} />);
      UI.clickTool("freedraw");
    });

    it("shows no pen-size slider", () => {
      expect(slider()).toBeNull();
    });
  });
});
