import React from "react";

import { BOUND_TEXT_PADDING, CONTAINER_PADDING } from "@excalidraw/common";
import {
  computeContainerDimensionForBoundText,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  getContainerCoords,
  getContainerPadding,
} from "@excalidraw/element";

import type {
  ExcalidrawRectangleElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";

import { actionChangePadding } from "../actions/actionProperties";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

const withPadding = <T extends object>(element: T, padding: number) =>
  ({ ...element, padding } as T);

describe("container padding", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("defaults to BOUND_TEXT_PADDING (the Small preset)", () => {
    const rect = API.createElement({ type: "rectangle", width: 100 });
    expect(getContainerPadding(rect)).toBe(BOUND_TEXT_PADDING);
    expect(CONTAINER_PADDING.small).toBe(BOUND_TEXT_PADDING);
  });

  it("applies a custom padding to bound text layout", () => {
    const params = { width: 178, height: 194, x: 10, y: 20 };
    const rect = withPadding(
      API.createElement({ type: "rectangle", ...params }),
      20,
    );
    expect(getBoundTextMaxWidth(rect, null)).toBe(178 - 40);
    expect(
      getBoundTextMaxHeight(
        rect,
        API.createElement({
          type: "text",
        }) as ExcalidrawTextElementWithContainer,
      ),
    ).toBe(194 - 40);
    expect(getContainerCoords(rect)).toEqual({ x: 30, y: 40 });
    expect(computeContainerDimensionForBoundText(100, "rectangle", 20)).toBe(
      140,
    );

    const none = withPadding(
      API.createElement({ type: "ellipse", ...params }),
      0,
    );
    expect(getBoundTextMaxWidth(none, null)).toBe(
      Math.round((178 / 2) * Math.sqrt(2)),
    );
  });

  it("clamps invalid padding values", () => {
    const rect = API.createElement({ type: "rectangle" });
    expect(getContainerPadding(withPadding(rect, -10))).toBe(0);
    expect(getContainerPadding(withPadding(rect, 10_000))).toBe(100);
    expect(getContainerPadding(withPadding(rect, NaN))).toBe(
      BOUND_TEXT_PADDING,
    );
  });

  it("changePadding updates the container and re-lays out its label", () => {
    const [container, text] = API.createTextContainer();
    API.setElements([container, text]);
    API.setSelectedElements([container]);

    act(() => {
      h.app.actionManager.executeAction(
        actionChangePadding,
        "ui",
        CONTAINER_PADDING.medium,
      );
    });

    const nextContainer = h.elements.find(
      (el) => el.id === container.id,
    ) as ExcalidrawRectangleElement;
    const nextText = h.elements.find(
      (el) => el.id === text.id,
    ) as ExcalidrawTextElement;

    expect(nextContainer.padding).toBe(CONTAINER_PADDING.medium);
    // label stays inside the padded box
    expect(nextText.x).toBeGreaterThanOrEqual(
      nextContainer.x + CONTAINER_PADDING.medium,
    );
    expect(nextText.x + nextText.width).toBeLessThanOrEqual(
      nextContainer.x + nextContainer.width - CONTAINER_PADDING.medium,
    );
  });
});
