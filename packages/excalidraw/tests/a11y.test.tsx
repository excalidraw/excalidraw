import React from "react";

import { arrayToMap } from "@excalidraw/common";

import { KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";
import {
  a11yHelpDialogAtom,
  getElementDescription,
  getSceneReadingOrder,
} from "../a11y";
import {
  actionConnectElements,
  actionToggleSingleKeyShortcuts,
} from "../actions";
import { editorJotaiStore } from "../editor-jotai";

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
    ).toBe('"Start", Rectangle, black, 3 of 12, selected');
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
      "Arrow from Start to Ellipse, black",
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
      'Rectangle, black, in frame "Login flow", locked, has link',
    );
  });

  it("describes stroke and fill colors conceptually", () => {
    const redOutline = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      strokeColor: "#e03131",
    });
    expect(getElementDescription(redOutline, arrayToMap([redOutline]))).toBe(
      "Rectangle, red",
    );

    const filled = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      strokeColor: "#1971c2",
      backgroundColor: "#b2f2bb",
    });
    expect(getElementDescription(filled, arrayToMap([filled]))).toBe(
      "Ellipse, blue, light green fill",
    );

    // same conceptual color for stroke and fill is announced once
    const monochrome = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      strokeColor: "#e03131",
      backgroundColor: "#fa5252",
    });
    expect(getElementDescription(monochrome, arrayToMap([monochrome]))).toBe(
      "Diamond, red",
    );
  });
});

describe("a11y geometric containment (layers)", () => {
  it("describes nesting inside labeled boxes and their child counts", () => {
    const zone = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
    const zoneLabel = API.createElement({
      type: "text",
      containerId: zone.id,
      text: "Storage zone",
    });
    const zoneLabeled = {
      ...zone,
      boundElements: [{ type: "text" as const, id: zoneLabel.id }],
    };
    const inner = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const outside = API.createElement({
      type: "rectangle",
      x: 800,
      y: 0,
      width: 100,
      height: 100,
    });
    const elementsMap = arrayToMap([zoneLabeled, zoneLabel, inner, outside]);

    expect(getElementDescription(inner, elementsMap)).toBe(
      'Rectangle, black, inside "Storage zone"',
    );
    expect(getElementDescription(zoneLabeled, elementsMap)).toBe(
      '"Storage zone", Rectangle, black, contains 1 element',
    );
    expect(getElementDescription(outside, elementsMap)).toBe(
      "Rectangle, black",
    );
  });

  it("assigns elements to the nearest (smallest) labeled container", () => {
    const outer = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
    const outerLabel = API.createElement({
      type: "text",
      containerId: outer.id,
      text: "Outer",
    });
    const innerZone = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 400,
      height: 400,
    });
    const innerLabel = API.createElement({
      type: "text",
      containerId: innerZone.id,
      text: "Inner",
    });
    const leaf = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    const elementsMap = arrayToMap([
      {
        ...outer,
        boundElements: [{ type: "text" as const, id: outerLabel.id }],
      },
      outerLabel,
      {
        ...innerZone,
        boundElements: [{ type: "text" as const, id: innerLabel.id }],
      },
      innerLabel,
      leaf,
    ]);

    expect(getElementDescription(leaf, elementsMap)).toContain(
      'inside "Inner"',
    );
    expect(getElementDescription(leaf, elementsMap)).not.toContain(
      'inside "Outer"',
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
    expect(proxies[0].getAttribute("aria-label")).toBe(
      "Rectangle, black, 1 of 2",
    );
    expect(proxies[1].getAttribute("aria-label")).toBe(
      "Ellipse, black, 2 of 2",
    );
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
      "Rectangle, black, connected to End",
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

  it("presents the help region as a list with a hidden trigger", () => {
    const region = document.querySelector(
      "section.excalidraw-a11y-help-region",
    );
    expect(region).not.toBeNull();
    const items = region!.querySelectorAll("ul > li");
    expect(items.length).toBeGreaterThanOrEqual(4);
    const button = region!.querySelector("button");
    expect(button).not.toBeNull();

    act(() => button!.click());
    expect(document.querySelector(".a11y-help-dialog")).not.toBeNull();
  });

  it("starts closed even when the atom was left open by a previous mount", async () => {
    act(() => editorJotaiStore.set(a11yHelpDialogAtom, true));
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    expect(editorJotaiStore.get(a11yHelpDialogAtom)).toBe(false);
    expect(document.querySelector(".a11y-help-dialog")).toBeNull();
  });
});

describe("a11y connection navigation feedback", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const liveRegionText = () =>
    document.getElementById("excalidraw-a11y-announcer")?.textContent ?? "";

  const focusProxyOf = (elementId: string) => {
    const proxy = queryProxies().find(
      (p) => p.getAttribute("data-a11y-element-id") === elementId,
    )!;
    act(() => proxy.focus());
  };

  it("announces when Alt+Arrow finds no connection", () => {
    const lone = API.createElement({ type: "rectangle", x: 0, y: 0 });
    API.setElements([lone]);
    focusProxyOf(lone.id);

    fireEvent.keyDown(document, { key: "ArrowRight", altKey: true });
    expect(liveRegionText()).toContain("No connection to the right");
  });

  it("cycles through all connections with Alt+N regardless of direction", () => {
    const anchor = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 50,
      height: 50,
    });
    const west = API.createElement({
      type: "rectangle",
      x: 0,
      y: 300,
      width: 50,
      height: 50,
    });
    const north = API.createElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 50,
      height: 50,
    });
    const arrowToWest = API.createElement({
      type: "arrow",
      x: 290,
      y: 325,
      startBinding: {
        elementId: anchor.id,
        fixedPoint: [0, 0.5],
        mode: "orbit",
      },
      endBinding: { elementId: west.id, fixedPoint: [1, 0.5], mode: "orbit" },
    });
    const arrowToNorth = API.createElement({
      type: "arrow",
      x: 325,
      y: 290,
      startBinding: {
        elementId: anchor.id,
        fixedPoint: [0.5, 0],
        mode: "orbit",
      },
      endBinding: {
        elementId: north.id,
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });
    API.setElements([
      {
        ...anchor,
        boundElements: [
          { type: "arrow" as const, id: arrowToWest.id },
          { type: "arrow" as const, id: arrowToNorth.id },
        ],
      },
      {
        ...west,
        boundElements: [{ type: "arrow" as const, id: arrowToWest.id }],
      },
      {
        ...north,
        boundElements: [{ type: "arrow" as const, id: arrowToNorth.id }],
      },
      arrowToWest,
      arrowToNorth,
    ]);
    focusProxyOf(anchor.id);

    fireEvent.keyDown(document, { key: "n", code: "KeyN", altKey: true });
    expect(window.h.state.selectedElementIds[west.id]).toBe(true);
    expect(liveRegionText()).toContain("Connection 1 of 2");

    fireEvent.keyDown(document, { key: "n", code: "KeyN", altKey: true });
    expect(window.h.state.selectedElementIds[north.id]).toBe(true);
    expect(liveRegionText()).toContain("Connection 2 of 2");

    // wraps around, still enumerating the original anchor's connections
    fireEvent.keyDown(document, { key: "n", code: "KeyN", altKey: true });
    expect(window.h.state.selectedElementIds[west.id]).toBe(true);
    expect(liveRegionText()).toContain("Connection 1 of 2");
  });

  it("announces when the element has no connections at all", () => {
    const lone = API.createElement({ type: "rectangle", x: 0, y: 0 });
    API.setElements([lone]);
    focusProxyOf(lone.id);

    fireEvent.keyDown(document, { key: "n", code: "KeyN", altKey: true });
    expect(liveRegionText()).toContain("No connections");
  });

  it("cycles through nested elements with Alt+I and jumps up with Alt+Shift+I", () => {
    const zone = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 600,
      height: 600,
    });
    const zoneLabel = API.createElement({
      type: "text",
      containerId: zone.id,
      text: "Zone",
    });
    const first = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const second = API.createElement({
      type: "ellipse",
      x: 300,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([
      { ...zone, boundElements: [{ type: "text" as const, id: zoneLabel.id }] },
      zoneLabel,
      first,
      second,
    ]);
    focusProxyOf(zone.id);

    // enumerate the zone's nested elements in reading order, wrapping
    fireEvent.keyDown(document, { key: "i", code: "KeyI", altKey: true });
    expect(window.h.state.selectedElementIds[first.id]).toBe(true);
    expect(liveRegionText()).toContain("Contained element 1 of 2");

    fireEvent.keyDown(document, { key: "i", code: "KeyI", altKey: true });
    expect(window.h.state.selectedElementIds[second.id]).toBe(true);
    expect(liveRegionText()).toContain("Contained element 2 of 2");

    fireEvent.keyDown(document, { key: "i", code: "KeyI", altKey: true });
    expect(window.h.state.selectedElementIds[first.id]).toBe(true);
    expect(liveRegionText()).toContain("Contained element 1 of 2");

    // Alt+Shift+I: back up to the containing box
    fireEvent.keyDown(document, {
      key: "I",
      code: "KeyI",
      altKey: true,
      shiftKey: true,
    });
    expect(window.h.state.selectedElementIds[zone.id]).toBe(true);

    // moving focus by other means resets the cycle: Alt+I on a leaf
    // then drills into the leaf (which has nothing inside)
    fireEvent.keyDown(document, { key: "i", code: "KeyI", altKey: true });
    expect(liveRegionText()).toContain("Contained element 1 of 2");
    focusProxyOf(second.id);
    fireEvent.keyDown(document, { key: "i", code: "KeyI", altKey: true });
    expect(liveRegionText()).toContain("No contained elements");
  });

  it("announces when the element is not inside any box", () => {
    const lone = API.createElement({ type: "rectangle", x: 0, y: 0 });
    API.setElements([lone]);
    focusProxyOf(lone.id);

    fireEvent.keyDown(document, {
      key: "I",
      code: "KeyI",
      altKey: true,
      shiftKey: true,
    });
    expect(liveRegionText()).toContain("Not inside a box");
  });
});

describe("a11y jump to canvas", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("focuses the current element proxy with Alt+Shift+A", () => {
    const first = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const second = API.createElement({ type: "ellipse", x: 300, y: 0 });
    API.setElements([first, second]);

    fireEvent.keyDown(document, {
      key: "A",
      code: "KeyA",
      altKey: true,
      shiftKey: true,
    });
    expect(document.activeElement?.getAttribute("data-a11y-element-id")).toBe(
      first.id,
    );
  });

  it("focuses the container when the canvas is empty", () => {
    fireEvent.keyDown(document, {
      key: "A",
      code: "KeyA",
      altKey: true,
      shiftKey: true,
    });
    expect(document.activeElement?.classList.contains("excalidraw")).toBe(true);
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
