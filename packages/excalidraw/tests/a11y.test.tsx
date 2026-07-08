import React from "react";

import { arrayToMap } from "@excalidraw/common";

import { KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";
import { getElementDescription, getSceneReadingOrder } from "../a11y";
import {
  actionConnectElements,
  actionToggleSingleKeyShortcuts,
} from "../actions";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

const queryProxies = () =>
  Array.from(
    document.querySelectorAll<HTMLDivElement>(
      ".excalidraw-a11y-scene .excalidraw-a11y-scene__element",
    ),
  );

describe("a11y reading order", () => {
  it("orders elements top-to-bottom in bands, left-to-right within a band", () => {
    const topRight = API.createElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 50,
      height: 50,
    });
    const topLeft = API.createElement({
      type: "ellipse",
      x: 0,
      y: 10,
      width: 50,
      height: 50,
    });
    const bottom = API.createElement({
      type: "diamond",
      x: 0,
      y: 200,
      width: 50,
      height: 50,
    });

    expect(
      getSceneReadingOrder([bottom, topRight, topLeft]).map((el) => el.id),
    ).toEqual([topLeft.id, topRight.id, bottom.id]);
  });

  it("skips deleted and container-bound text elements", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const boundText = API.createElement({
      type: "text",
      x: 10,
      y: 40,
      containerId: rectangle.id,
      text: "label",
    });
    const deleted = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      isDeleted: true,
    });

    expect(
      getSceneReadingOrder([rectangle, boundText, deleted]).map((el) => el.id),
    ).toEqual([rectangle.id]);
  });
});

describe("a11y element descriptions", () => {
  it("describes a labeled shape with position and state", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const boundText = API.createElement({
      type: "text",
      containerId: rectangle.id,
      text: "Start",
    });
    const labeled = {
      ...rectangle,
      boundElements: [{ type: "text" as const, id: boundText.id }],
    };
    const elementsMap = arrayToMap([labeled, boundText]);

    expect(
      getElementDescription(labeled, elementsMap, {
        position: 3,
        total: 12,
        selected: true,
      }),
    ).toBe('"Start", Rectangle, 3 of 12, selected');
  });

  it("describes arrows by their bound endpoints", () => {
    const start = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const startText = API.createElement({
      type: "text",
      containerId: start.id,
      text: "Start",
    });
    const startLabeled = {
      ...start,
      boundElements: [{ type: "text" as const, id: startText.id }],
    };
    const end = API.createElement({ type: "ellipse", x: 300, y: 0 });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      startBinding: {
        elementId: start.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
      endBinding: {
        elementId: end.id,
        fixedPoint: [0, 0.5],
        mode: "orbit",
      },
    });
    const elementsMap = arrayToMap([startLabeled, startText, end, arrow]);

    expect(getElementDescription(arrow, elementsMap)).toBe(
      "Arrow from Start to Ellipse",
    );
  });

  it("includes frame, lock and link state", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 500,
        height: 500,
      }),
      name: "Login flow",
    };
    const rectangle = {
      ...API.createElement({
        type: "rectangle",
        x: 10,
        y: 10,
        locked: true,
      }),
      frameId: frame.id,
      link: "https://example.com",
    };
    const elementsMap = arrayToMap([frame, rectangle]);

    expect(getElementDescription(rectangle, elementsMap)).toBe(
      'Rectangle, in frame "Login flow", locked, has link',
    );
  });
});

describe("a11y scene proxy layer", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("renders one labeled proxy per element in reading order", () => {
    const first = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    const second = API.createElement({
      type: "ellipse",
      x: 200,
      y: 0,
      width: 50,
      height: 50,
    });
    API.setElements([second, first]);

    const proxies = queryProxies();
    expect(proxies.length).toBe(2);
    expect(proxies[0].getAttribute("data-a11y-element-id")).toBe(first.id);
    expect(proxies[0].getAttribute("aria-label")).toBe("Rectangle, 1 of 2");
    expect(proxies[1].getAttribute("aria-label")).toBe("Ellipse, 2 of 2");
    // roving tabindex: only the current proxy is tabbable
    expect(proxies[0].tabIndex).toBe(0);
    expect(proxies[1].tabIndex).toBe(-1);
  });

  it("selects the element when its proxy receives focus", () => {
    const rectangle = API.createElement({ type: "rectangle", x: 0, y: 0 });
    API.setElements([rectangle]);

    act(() => queryProxies()[0].focus());

    expect(window.h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("moves through elements with Tab and exits at the end", () => {
    const first = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const second = API.createElement({ type: "ellipse", x: 200, y: 0 });
    API.setElements([first, second]);

    const proxies = queryProxies();
    act(() => proxies[0].focus());
    fireEvent.keyDown(proxies[0], { key: "Tab" });
    expect(document.activeElement).toBe(queryProxies()[1]);
    expect(window.h.state.selectedElementIds[second.id]).toBe(true);

    fireEvent.keyDown(queryProxies()[1], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(queryProxies()[0]);
  });

  it("moves spatially with Ctrl+Alt+Arrow", () => {
    const left = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const right = API.createElement({ type: "ellipse", x: 300, y: 0 });
    const below = API.createElement({ type: "diamond", x: 0, y: 300 });
    API.setElements([left, right, below]);

    const proxies = queryProxies();
    act(() => proxies[0].focus());

    fireEvent.keyDown(proxies[0], {
      key: "ArrowRight",
      ctrlKey: true,
      altKey: true,
    });
    expect(document.activeElement?.getAttribute("data-a11y-element-id")).toBe(
      right.id,
    );

    fireEvent.keyDown(document.activeElement!, {
      key: "ArrowDown",
      ctrlKey: true,
      altKey: true,
    });
    expect(document.activeElement?.getAttribute("data-a11y-element-id")).toBe(
      below.id,
    );
  });

  it("hides the canvases from assistive technology", () => {
    API.setElements([API.createElement({ type: "rectangle", x: 0, y: 0 })]);
    expect(
      document
        .querySelector(".excalidraw__canvas.interactive")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});

describe("a11y keyboard creation & manipulation", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("inserts a default-sized element on Enter with a shape tool active", () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.ENTER);

    expect(window.h.elements.length).toBe(1);
    const element = window.h.elements[0];
    expect(element.type).toBe("rectangle");
    expect(element.width).toBe(100);
    expect(element.height).toBe(100);
    // inserted element is selected, ready for keyboard manipulation
    expect(window.h.state.selectedElementIds[element.id]).toBe(true);
  });

  it("inserts an arrow on Enter with the arrow tool active", () => {
    UI.clickTool("arrow");
    Keyboard.keyPress(KEYS.ENTER);

    expect(window.h.elements.length).toBe(1);
    expect(window.h.elements[0].type).toBe("arrow");
  });

  it("resizes the selected element with Alt+Shift+Arrows", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    expect(window.h.elements[0].width).toBe(110);
    expect(window.h.elements[0].height).toBe(120);
  });

  it("rotates the selected element with Alt+Shift+R / Alt+Shift+E", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    fireEvent.keyDown(document, {
      key: "R",
      code: "KeyR",
      altKey: true,
      shiftKey: true,
    });
    expect(window.h.elements[0].angle).toBeCloseTo(Math.PI / 12);

    fireEvent.keyDown(document, {
      key: "E",
      code: "KeyE",
      altKey: true,
      shiftKey: true,
    });
    expect(window.h.elements[0].angle).toBeCloseTo(0);
  });

  it("announces shape connections derived from bound arrows", () => {
    const start = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const end = API.createElement({ type: "ellipse", x: 300, y: 0 });
    const endText = API.createElement({
      type: "text",
      containerId: end.id,
      text: "End",
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      startBinding: {
        elementId: start.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
      endBinding: { elementId: end.id, fixedPoint: [0, 0.5], mode: "orbit" },
    });
    const startBound = {
      ...start,
      boundElements: [{ type: "arrow" as const, id: arrow.id }],
    };
    const endBound = {
      ...end,
      boundElements: [
        { type: "arrow" as const, id: arrow.id },
        { type: "text" as const, id: endText.id },
      ],
    };
    const elementsMap = arrayToMap([startBound, endBound, endText, arrow]);

    expect(getElementDescription(startBound, elementsMap)).toBe(
      "Rectangle, connected to End",
    );
  });

  it("places keyboard-inserted elements below the anchor element", () => {
    const anchor = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([anchor]);
    API.setSelectedElements([anchor]);

    UI.clickTool("ellipse");
    // tool switch cleared selection; re-select to use the selection anchor
    API.setSelectedElements([anchor]);
    Keyboard.keyPress(KEYS.ENTER);

    const inserted = window.h.elements.find((el) => el.type === "ellipse")!;
    expect(inserted).toBeDefined();
    // left-aligned with the anchor, 40px below it
    expect(inserted.x).toBe(anchor.x);
    expect(inserted.y).toBe(anchor.y + anchor.height + 40);
  });

  it("connects two selected shapes with a bound arrow", () => {
    const left = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const right = API.createElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([left, right]);
    API.setSelectedElements([left, right]);

    act(() => {
      window.h.app.actionManager.executeAction(
        actionConnectElements,
        "contextMenu",
      );
    });

    const arrow = window.h.elements.find((el) => el.type === "arrow") as any;
    expect(arrow).toBeDefined();
    expect(arrow.startBinding?.elementId).toBe(left.id);
    expect(arrow.endBinding?.elementId).toBe(right.id);
  });

  it("uses persisted alt text in image descriptions", () => {
    const image = {
      ...API.createElement({ type: "image", x: 0, y: 0 }),
      customData: { a11y: { altText: "A team photo" } },
    };
    const elementsMap = arrayToMap([image]);

    expect(getElementDescription(image, elementsMap)).toBe(
      '"A team photo", Image',
    );
  });

  it("inserts elements for a specific tool (command palette path)", () => {
    window.h.app.insertElementFromKeyboard("diamond");

    expect(window.h.elements.length).toBe(1);
    expect(window.h.elements[0].type).toBe("diamond");
    // the active tool is untouched
    expect(window.h.state.activeTool.type).toBe("selection");
  });

  it("cycles and moves linear-element points with Tab and arrows", () => {
    const line = API.createElement({
      type: "line",
      x: 10,
      y: 10,
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    API.setElements([line]);
    API.setSelectedElements([line]);

    // Enter starts point editing for lines
    Keyboard.keyPress(KEYS.ENTER);
    expect(window.h.state.selectedLinearElement?.isEditing).toBe(true);

    // Tab selects the first point
    Keyboard.keyPress(KEYS.TAB);
    expect(window.h.state.selectedLinearElement?.selectedPointsIndices).toEqual(
      [0],
    );

    // arrows move the active point (moving point 0 shifts the element x)
    const previousX = window.h.elements[0].x;
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(window.h.elements[0].x).toBe(previousX + 1);

    // Tab moves on to the second point, Shift+Tab back
    Keyboard.keyPress(KEYS.TAB);
    expect(window.h.state.selectedLinearElement?.selectedPointsIndices).toEqual(
      [1],
    );
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(window.h.state.selectedLinearElement?.selectedPointsIndices).toEqual(
      [0],
    );
  });

  it("suppresses single-key tool shortcuts when toggled off (WCAG 2.1.4)", () => {
    expect(window.h.state.singleKeyShortcutsEnabled).toBe(true);

    act(() => {
      window.h.app.actionManager.executeAction(
        actionToggleSingleKeyShortcuts,
        "commandPalette",
      );
    });
    expect(window.h.state.singleKeyShortcutsEnabled).toBe(false);

    Keyboard.keyPress("r");
    expect(window.h.state.activeTool.type).toBe("selection");

    act(() => {
      window.h.app.actionManager.executeAction(
        actionToggleSingleKeyShortcuts,
        "commandPalette",
      );
    });
    Keyboard.keyPress("r");
    expect(window.h.state.activeTool.type).toBe("rectangle");
  });
});

describe("a11y screen reader help dialog", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("opens with Alt+Shift+H and closes with Escape", () => {
    expect(document.querySelector(".a11y-help-dialog")).toBeNull();

    fireEvent.keyDown(document, {
      key: "H",
      code: "KeyH",
      altKey: true,
      shiftKey: true,
    });
    const dialog = document.querySelector(".a11y-help-dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(
      "How to navigate with a screen reader",
    );

    fireEvent.keyDown(document.querySelector(".Modal")!, { key: "Escape" });
    expect(document.querySelector(".a11y-help-dialog")).toBeNull();
  });

  it("has a visually hidden trigger in the help region", () => {
    const region = document.querySelector("section.visually-hidden");
    expect(region).not.toBeNull();
    const button = region!.querySelector("button");
    expect(button).not.toBeNull();

    act(() => button!.click());
    expect(document.querySelector(".a11y-help-dialog")).not.toBeNull();
  });
});

describe("a11y keyboard multi-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("toggles the focused element in the selection with Space", () => {
    const first = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const second = API.createElement({ type: "ellipse", x: 300, y: 0 });
    API.setElements([first, second]);

    const proxies = queryProxies();
    act(() => proxies[0].focus());
    expect(window.h.state.selectedElementIds[first.id]).toBe(true);

    // travel without changing the selection, then add with Space
    fireEvent.keyDown(proxies[0], {
      key: "ArrowRight",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(document.activeElement?.getAttribute("data-a11y-element-id")).toBe(
      second.id,
    );
    expect(window.h.state.selectedElementIds[first.id]).toBe(true);
    expect(window.h.state.selectedElementIds[second.id]).toBeFalsy();

    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(window.h.state.selectedElementIds[first.id]).toBe(true);
    expect(window.h.state.selectedElementIds[second.id]).toBe(true);

    // Space again removes it
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(window.h.state.selectedElementIds[second.id]).toBeFalsy();
  });
});
