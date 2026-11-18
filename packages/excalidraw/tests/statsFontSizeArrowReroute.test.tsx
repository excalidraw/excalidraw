import { pointFrom } from "@excalidraw/math";

import { vi } from "vitest";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

vi.mock("@excalidraw/element/textMeasurements", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("@excalidraw/element/textMeasurements")
  >();
  return {
    ...mod,
    measureText: (text: string, font: string, lineHeight: number) => {
      const fontSize = parseFloat(font);
      const lines = text.split("\n");
      const width =
        Math.max(...lines.map((line) => line.length)) * fontSize * 0.6;
      return { width, height: fontSize * 1.25 * lines.length };
    },
  };
});

const getText = (id: string) =>
  h.elements.find(
    (el): el is NonDeletedExcalidrawElement & ExcalidrawTextElement =>
      el.id === id,
  )!;

const getArrow = (id: string) =>
  h.elements.find((el): el is ExcalidrawArrowElement => el.id === id)!;

const endGlobal = (arrow: ExcalidrawArrowElement) => {
  const last = arrow.points[arrow.points.length - 1];
  return [arrow.x + last[0], arrow.y + last[1]] as const;
};

describe("stats panel font size re-routes arrows bound to the text", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("re-routes a bound arrow when a single text's font size changes in stats", async () => {
    const text = API.createElement({
      type: "text",
      id: "text1",
      x: 200,
      y: 200,
      text: "hello world",
      fontSize: 20,
    });

    API.setElements([
      {
        ...text,
        boundElements: [{ id: "arrow1", type: "arrow" }],
      },
      API.createElement({
        type: "arrow",
        id: "arrow1",
        x: 450,
        y: 200,
        width: 118,
        height: 10,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-118, 10)],
        endBinding: {
          elementId: "text1",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
      }),
    ]);

    const before = endGlobal(getArrow("arrow1"));

    API.setSelectedElements([getText("text1")]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });

    const fontSizeInput = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSizeInput).not.toBeNull();

    await act(async () => {
      UI.updateInput(fontSizeInput, "40");
    });

    const textAfter = getText("text1");
    const arrowAfter = getArrow("arrow1");
    expect(textAfter.fontSize).toBe(40);

    const end = endGlobal(arrowAfter);
    // Endpoint must be updated rather than staying at the initial position
    expect(end).not.toEqual(before);
    expect(end[0]).toBeGreaterThan(before[0]);
    expect(arrowAfter.endBinding?.elementId).toBe("text1");
  });

  it("re-routes bound arrows when multiple texts' font size changes in stats", async () => {
    const text1 = API.createElement({
      type: "text",
      id: "text1",
      x: 100,
      y: 100,
      text: "first line",
      fontSize: 20,
    });
    const text2 = API.createElement({
      type: "text",
      id: "text2",
      x: 100,
      y: 300,
      text: "second line",
      fontSize: 20,
    });

    API.setElements([
      {
        ...text1,
        boundElements: [{ id: "arrow1", type: "arrow" }],
      },
      {
        ...text2,
        boundElements: [{ id: "arrow2", type: "arrow" }],
      },
      API.createElement({
        type: "arrow",
        id: "arrow1",
        x: 350,
        y: 100,
        width: 118,
        height: 10,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-118, 10)],
        endBinding: {
          elementId: "text1",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
      }),
      API.createElement({
        type: "arrow",
        id: "arrow2",
        x: 350,
        y: 300,
        width: 118,
        height: 10,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-118, 10)],
        endBinding: {
          elementId: "text2",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
      }),
    ]);

    const before1 = endGlobal(getArrow("arrow1"));
    const before2 = endGlobal(getArrow("arrow2"));

    API.setSelectedElements([getText("text1"), getText("text2")]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });

    const fontSizeInput = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSizeInput).not.toBeNull();

    await act(async () => {
      UI.updateInput(fontSizeInput, "40");
    });

    const text1After = getText("text1");
    const text2After = getText("text2");
    const arrow1After = getArrow("arrow1");
    const arrow2After = getArrow("arrow2");

    expect(text1After.fontSize).toBe(40);
    expect(text2After.fontSize).toBe(40);

    const end1 = endGlobal(arrow1After);
    const end2 = endGlobal(arrow2After);

    // Endpoints must be updated rather than staying at their initial positions
    expect(end1).not.toEqual(before1);
    expect(end2).not.toEqual(before2);
    expect(end1[0]).toBeGreaterThan(before1[0]);
    expect(end2[0]).toBeGreaterThan(before2[0]);
    expect(arrow1After.endBinding?.elementId).toBe("text1");
    expect(arrow2After.endBinding?.elementId).toBe("text2");
  });
});
