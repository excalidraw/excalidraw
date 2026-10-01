import React from "react";

import type {
  ExcalidrawFrameElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  act,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const frameName = () =>
  GlobalTestState.renderResult.container.querySelector(".frame-name");

describe("frame names on a frame too small to hold its name", () => {
  let speck: NonDeleted<ExcalidrawFrameElement>;
  let result: unknown;

  beforeEach(async () => {
    mockBoundingClientRect({
      width: 1200,
      height: 1000,
      x: 0,
      left: 0,
      y: 0,
      top: 0,
      right: 1200,
      bottom: 1000,
    });
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(1200));
    speck = API.createElement({
      type: "frame",
      id: "frame-thunderwrench-speck",
      x: 100,
      y: 100,
      width: 60,
      height: 40,
    });
    API.setElements([speck]);
    API.updateElement(speck, { name: "Speck" });
    act(() => h.setState({ scrollX: 0, scrollY: 0 }));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  describe("when nothing points at it", () => {
    beforeEach(() => {
      result = frameName();
    });

    it("should not render its name", () => {
      expect(result).toBe(null);
    });
  });

  describe("when it is selected", () => {
    beforeEach(() => {
      act(() => API.setSelectedElements([speck]));
      result = frameName()?.textContent;
    });

    it("should render its name", () => {
      expect(result).toBe("Speck");
    });
  });

  describe("when it is deselected after its name was hit-tested", () => {
    beforeEach(() => {
      act(() => API.setSelectedElements([speck]));
      h.app.frameNameBoundsCache.get(speck);
      act(() => h.setState({ selectedElementIds: {} }));
      result = h.app.frameNameBoundsCache.get(speck);
    });

    it("should no longer hit-test its name", () => {
      expect(result).toBe(null);
    });
  });

  describe("when a mouse hovers it", () => {
    beforeEach(() => {
      act(() => new Pointer("mouse").moveTo(120, 120));
      result = frameName()?.textContent;
    });

    it("should render its name", () => {
      expect(result).toBe("Speck");
    });
  });

  describe("when a mouse moves from it up onto its name", () => {
    beforeEach(() => {
      const mouse = new Pointer("mouse");
      act(() => mouse.moveTo(120, 120));
      act(() => mouse.moveTo(120, 99));
      result = frameName()?.textContent;
    });

    it("should keep its name", () => {
      expect(result).toBe("Speck");
    });
  });

  describe("when a finger touches it", () => {
    beforeEach(() => {
      act(() => new Pointer("touch").moveTo(120, 120));
      result = frameName();
    });

    it("should not render its name", () => {
      expect(result).toBe(null);
    });
  });
});
