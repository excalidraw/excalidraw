import { KEYS } from "@excalidraw/common";
import {
  getCornerRadius,
  isTextElement,
  setCustomTextMetricsProvider,
  ShapeCache,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, render } from "./test-utils";

import type { Drawable } from "roughjs/bin/core";

import type { AuthoringUnits } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

const ZOOMS = [1, 100, 10_000];

// the test canvas measures every glyph 10px wide at any font size; text
// grows with its font here, as it does in a browser
setCustomTextMetricsProvider({
  getLineWidth: (text, font) => text.length * parseFloat(font) * 0.6,
});

const renderEditor = (authoringUnits?: AuthoringUnits) =>
  render(
    <Excalidraw
      authoringUnits={authoringUnits}
      handleKeyboardGlobally={true}
    />,
  );

const atZoom = (zoom: number) => {
  API.setElements([]);
  API.setAppState({
    zoom: { value: getNormalizedZoom(zoom) },
    scrollX: 0,
    scrollY: 0,
    // the eraser only sees what is in the viewport
    width: 1024,
    height: 768,
  });
};

const latest = () => h.elements.filter((element) => !element.isDeleted);

/** an element's sizes as they show on screen at `zoom` */
const onScreen = (element: ExcalidrawElement, zoom: number) => ({
  width: element.width * zoom,
  height: element.height * zoom,
  strokeWidth: element.strokeWidth * zoom,
  ...(isTextElement(element) && { fontSize: element.fontSize * zoom }),
});

const expectSameOnScreen = (
  actual: Record<string, number>,
  expected: Record<string, number>,
) => {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const [key, value] of Object.entries(expected)) {
    expect({ [key]: Math.round((actual[key] / value) * 1e9) / 1e9 }).toEqual({
      [key]: 1,
    });
  }
};

/** makes something at each zoom and compares how it looks with zoom 1 */
const expectSameAtEveryZoom = (
  make: (zoom: number) => Record<string, number>,
) => {
  const [first, ...rest] = ZOOMS.map((zoom) => {
    atZoom(zoom);
    return make(zoom);
  });
  for (const other of rest) {
    expectSameOnScreen(other, first);
  }
  return first;
};

const createText = async (x: number, y: number, text: string) => {
  UI.clickTool("text");
  mouse.clickAt(x, y);
  const editor = await getTextEditor();
  updateTextEditor(editor, text);
  Keyboard.exitTextEditor(editor);
  return latest().find(isTextElement)!;
};

describe("authoringUnits: screen", () => {
  beforeEach(async () => {
    await renderEditor("screen");
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it.each(["rectangle", "ellipse", "diamond", "arrow", "line"] as const)(
    "creates a %s with the same size and stroke on screen at any zoom",
    (type) => {
      expectSameAtEveryZoom((zoom) =>
        onScreen(
          UI.createElement(type, { x: 100, y: 100, width: 120, height: 80 }),
          zoom,
        ),
      );
    },
  );

  it("creates a frame with the same size on screen at any zoom", () => {
    expectSameAtEveryZoom((zoom) => {
      act(() => h.app.setActiveTool({ type: "frame" }));
      mouse.downAt(100, 100);
      mouse.moveTo(220, 180);
      mouse.upAt();
      const frame = latest().find((element) => element.type === "frame")!;
      const { width, height } = onScreen(frame, zoom);
      return { width, height };
    });
  });

  it("draws freedraw with the same size and stroke on screen at any zoom", () => {
    expectSameAtEveryZoom((zoom) =>
      onScreen(
        UI.createElement("freedraw", {
          x: 100,
          y: 100,
          points: [
            [0, 0],
            [40, 30],
            [80, 0],
          ] as any,
        }),
        zoom,
      ),
    );
  });

  it("creates text with the same font and size on screen at any zoom", async () => {
    const sizes = [];
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      sizes.push(onScreen(await createText(100, 100, "hello"), zoom));
    }
    expect(sizes[0].fontSize).toBe(20);
    expectSameOnScreen(sizes[1], sizes[0]);
    expectSameOnScreen(sizes[2], sizes[0]);
  });

  it("labels a shape without resizing it on screen, at the same font size", async () => {
    const sizes = [];
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      const rectangle = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });
      Keyboard.keyPress(KEYS.ENTER);
      const editor = await getTextEditor();
      updateTextEditor(editor, "hi");
      Keyboard.exitTextEditor(editor);
      const label = latest().find(isTextElement)!;
      sizes.push({
        ...onScreen(rectangle.get(), zoom),
        labelFontSize: label.fontSize * zoom,
      });
    }
    expectSameOnScreen(sizes[1], sizes[0]);
    expectSameOnScreen(sizes[2], sizes[0]);
    expect(sizes[0].width).toBe(200);
  });

  it("clicks a sticky note of the same size on screen at any zoom", () => {
    const first = expectSameAtEveryZoom((zoom) => {
      UI.clickTool("stickynote");
      mouse.clickAt(300, 300);
      const note = latest().find((element) => element.type === "stickynote")!;
      return onScreen(note, zoom);
    });
    expect(first.width).toBe(250);
  });

  it("rounds a rectangle's corners the same on screen at any zoom", () => {
    API.setAppState({ currentItemRoundness: "round" });
    const first = expectSameAtEveryZoom((zoom) => {
      const rectangle = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      }).get();
      return {
        radius:
          getCornerRadius(
            Math.min(rectangle.width, rectangle.height),
            rectangle,
          ) * zoom,
      };
    });
    expect(first.radius).toBe(32);
  });

  it("applies a named stroke width to the selection in screen units", () => {
    expectSameAtEveryZoom((zoom) => {
      const rectangle = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      UI.clickOnTestId("strokeWidth-bold");
      return { strokeWidth: rectangle.get().strokeWidth * zoom };
    });
    expect(h.elements[0].strokeWidth * 10_000).toBeCloseTo(4, 9);
  });

  it("applies a font size to the selection in screen units", async () => {
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      const text = await createText(100, 100, "hello");
      API.setSelectedElements([text as NonDeletedExcalidrawElement]);
      UI.clickOnTestId("fontSize-large");
      const resized = h.elements.find(
        (element) => element.id === text.id,
      ) as ExcalidrawTextElement;
      expect(resized.fontSize * zoom).toBeCloseTo(28, 9);
      expect(h.state.currentItemFontSize).toBe(28);
    }
  });

  it.each([
    ["erases a stroke the eraser passes near", 3, true],
    ["leaves a stroke the eraser passes wide of", 30, false],
  ])("%s the same at any zoom", (_, distance, erased) => {
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      const stroke = UI.createElement("freedraw", {
        x: 100,
        y: 200,
        points: [
          [0, 0],
          [50, 0],
          [100, 0],
        ] as any,
      });
      UI.clickTool("eraser");
      mouse.downAt(130, 200 - distance);
      mouse.moveTo(150, 200 - distance);
      mouse.moveTo(170, 200 - distance);
      mouse.upAt();
      expect({ zoom, erased: stroke.get().isDeleted }).toEqual({
        zoom,
        erased,
      });
    }
  });

  it.each([
    ["selects a shape clicked just off its stroke", 4, true],
    ["misses a shape clicked well off its stroke", 20, false],
  ])("%s the same at any zoom", (_, distance, selected) => {
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      const rectangle = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      });
      API.clearSelection();
      UI.clickTool("selection");
      mouse.clickAt(100 - distance, 140);
      expect({
        zoom,
        selected: !!h.state.selectedElementIds[rectangle.id],
      }).toEqual({ zoom, selected });
    }
  });
});

describe("authoringUnits: screen, the details drawn around new elements", () => {
  beforeEach(async () => {
    await renderEditor("screen");
    // exact on screen at the thinnest width, and without rough.js wobble
    API.setAppState({
      currentItemStrokeWidthKey: "thin",
      currentItemRoughness: 0,
    });
  });

  afterEach(async () => {
    await act(async () => {});
  });

  /** the on-screen extent of a drawable's points */
  const span = (drawables: Drawable[], zoom: number) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const drawable of drawables) {
      for (const set of drawable.sets) {
        for (const op of set.ops) {
          for (let i = 0; i < op.data.length; i += 2) {
            xs.push(op.data[i]);
            ys.push(op.data[i + 1]);
          }
        }
      }
    }
    return {
      width: (Math.max(...xs) - Math.min(...xs)) * zoom,
      height: (Math.max(...ys) - Math.min(...ys)) * zoom,
    };
  };

  it("draws an arrowhead the same size on screen at any zoom", () => {
    expectSameAtEveryZoom((zoom) => {
      const arrow = UI.createElement("arrow", {
        x: 100,
        y: 100,
        width: 200,
        height: 0,
      }).get() as ExcalidrawArrowElement;
      const [, ...arrowhead] = ShapeCache.generateElementShape(
        arrow,
        null,
      ) as Drawable[];
      return span(arrowhead, zoom);
    });
  });

  it("dashes a stroke the same on screen at any zoom", () => {
    API.setAppState({ currentItemStrokeStyle: "dashed" });
    const first = expectSameAtEveryZoom((zoom) => {
      const rectangle = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      }).get();
      const { options } = ShapeCache.generateElementShape(
        rectangle,
        null,
      ) as Drawable;
      const [dash, gap] = options.strokeLineDash!;
      return { dash: dash * zoom, gap: gap * zoom };
    });
    expect(first).toEqual({ dash: 8, gap: 9 });
  });

  it.each([
    ["binds an arrow that ends just off a shape", 8, true],
    ["leaves an arrow that ends well off a shape unbound", 40, false],
  ])("%s the same at any zoom", (_, distance, bound) => {
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      UI.createElement("rectangle", {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      });
      UI.clickTool("arrow");
      mouse.downAt(500, 150);
      mouse.moveTo(300, 150);
      mouse.moveTo(200 + distance, 150);
      mouse.upAt();
      const arrow = latest().find(
        (element): element is ExcalidrawArrowElement =>
          element.type === "arrow",
      )!;
      expect({ zoom, bound: !!arrow.endBinding }).toEqual({ zoom, bound });
    }
  });

  it("shows and snaps to a grid of about the same size on screen at any zoom", () => {
    const steps = ZOOMS.map((zoom) => {
      atZoom(zoom);
      API.setAppState({ gridModeEnabled: true, gridSize: 20, gridStep: 5 });
      return h.app.getEffectiveGridSize()!;
    });
    ZOOMS.forEach((zoom, i) => {
      expect(steps[i] * zoom).toBeGreaterThanOrEqual(20);
      expect(steps[i] * zoom).toBeLessThan(100);
      // a finer grid lines up with the coarser ones
      const ratio = Math.log(steps[0] / steps[i]) / Math.log(5);
      expect(ratio).toBeCloseTo(Math.round(ratio), 9);
    });
  });

  it("draws the eraser's trail about the same on screen at any zoom", () => {
    // the trail library's corner detection reads the pointer's speed in
    // scene units, so only the size is compared
    const areas = ZOOMS.map((zoom) => {
      atZoom(zoom);
      UI.clickTool("eraser");
      mouse.downAt(100, 100);
      mouse.moveTo(200, 100);
      mouse.moveTo(300, 100);
      const outline = h.app.eraserTrail
        .getCurrentTrail()!
        .getStrokeOutline(5 / zoom);
      mouse.upAt();
      // the filled outline's area, in screen px²
      const area =
        Math.abs(
          outline.reduce((sum, [x, y], i) => {
            const [nextX, nextY] = outline[(i + 1) % outline.length];
            return sum + x * nextY - nextX * y;
          }, 0) / 2,
        ) *
        zoom ** 2;
      return area;
    });
    for (const area of areas) {
      expect(area / areas[0]).toBeGreaterThan(0.66);
      expect(area / areas[0]).toBeLessThan(1.5);
    }
  });
});

describe("authoringUnits: scene (default)", () => {
  beforeEach(async () => {
    await renderEditor();
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("keeps new elements' sizes in scene units at any zoom", async () => {
    for (const zoom of ZOOMS) {
      atZoom(zoom);
      expect(
        UI.createElement("rectangle", { x: 100, y: 100, width: 120 })
          .strokeWidth,
      ).toBe(2);
      expect((await createText(100, 300, "hi")).fontSize).toBe(20);
      UI.clickTool("stickynote");
      mouse.clickAt(300, 300);
      const note = latest().find((element) => element.type === "stickynote")!;
      expect(note.width).toBe(250);
    }
  });
});
