import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { vi } from "vitest";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

vi.mock("@excalidraw/element/textMeasurements", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@excalidraw/element/src/textMeasurements")>();
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
  h.elements.find((el): el is ExcalidrawTextElement => el.id === id)!;

const getArrow = (id: string) =>
  h.elements.find((el): el is ExcalidrawArrowElement => el.id === id)!;

const endGlobal = (arrow: ExcalidrawArrowElement) => {
  const last = arrow.points[arrow.points.length - 1];
  return [arrow.x + last[0], arrow.y + last[1]] as const;
};

describe("stats panel font size re-routes arrows bound to the text", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("moves the bound arrow endpoint when the text grows (issue #12475)", async () => {
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
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(-118, 10),
        ],
        endBinding: {
          elementId: "text1",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
      }),
    ]);

    UI.clickTool("selection");
    API.setSelectedElements([getText("text1")]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });

    const fontSizeInput = document.querySelector(
      '[data-testid="F"] input',
    ) as HTMLInputElement;
    expect(fontSizeInput).not.toBeNull();

    await act(async () => {
      fireEvent.focus(fontSizeInput);
      fireEvent.change(fontSizeInput, { target: { value: "40" } });
      fireEvent.blur(fontSizeInput);
    });

    const textAfter = getText("text1");
    const arrowAfter = getArrow("arrow1");
    expect(textAfter.fontSize).toBe(40);
    expect(textAfter.x).toBe(200);

    const [afterX] = endGlobal(arrowAfter);
    // endpoint must follow the grown right edge instead of staying put
    expect(afterX).toBeGreaterThan(200 + 11 * 20 * 0.6);
    expect(arrowAfter.endBinding?.elementId).toBe("text1");
  });
});
