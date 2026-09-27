import React from "react";

import { exportToCanvas } from "@excalidraw/utils";

import {
  elementWithCanvasCache,
  setTextInlineHooks,
} from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import * as exportUtils from "../scene/export";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

// sdamex (#5072): host hooks for inline fragments of text elements.
const OPEN = "\uFDD0";
const CLOSE = "\uFDD1";
const FORMULA_LINE = `x = ${OPEN}\\frac{1}{2}${CLOSE}`;

const textElement = () =>
  API.createElement({
    type: "text",
    id: "math-text",
    text: `plain line\n${FORMULA_LINE}`,
    x: 0,
    y: 0,
  }) as NonDeleted<ExcalidrawTextElement>;

describe("sdamex: text inline hooks", () => {
  afterEach(() => {
    setTextInlineHooks(null);
  });

  it("lets the host draw the lines it takes and falls back to fillText", async () => {
    const calls: { line: string; x: number; y: number }[] = [];
    setTextInlineHooks({
      renderLine: (context, element, line, x, y) => {
        calls.push({ line, x, y });
        if (!line.includes(OPEN)) {
          return false;
        }
        context.fillRect(x, y, 7, 7);
        return true;
      },
    });

    const canvas = await exportToCanvas({
      elements: [textElement()],
      files: null,
      appState: { exportBackground: false, viewBackgroundColor: "#ffffff" },
    });
    const events = (canvas.getContext("2d") as any).__getEvents();
    const filledTexts = events
      .filter((event: any) => event.type === "fillText")
      .map((event: any) => event.props.text);

    expect(calls.map((call) => call.line)).toEqual([
      "plain line",
      FORMULA_LINE,
    ]);
    // the second line sits one line height below the first
    expect(calls[1].y).toBeGreaterThan(calls[0].y);
    expect(filledTexts).toContain("plain line");
    expect(filledTexts).not.toContain(FORMULA_LINE);
    expect(
      events.some(
        (event: any) =>
          event.type === "fillRect" &&
          event.props.width === 7 &&
          event.props.height === 7,
      ),
    ).toBe(true);
  });

  it("draws every line with fillText without hooks", async () => {
    const canvas = await exportToCanvas({
      elements: [textElement()],
      files: null,
      appState: { exportBackground: false, viewBackgroundColor: "#ffffff" },
    });
    const filledTexts = (canvas.getContext("2d") as any)
      .__getEvents()
      .filter((event: any) => event.type === "fillText")
      .map((event: any) => event.props.text);
    expect(filledTexts).toEqual(["plain line", FORMULA_LINE]);
  });

  it("lets the host emit SVG for the lines it takes", async () => {
    setTextInlineHooks({
      renderLineSvg: (document, element, line, attrs) => {
        if (!line.includes(OPEN)) {
          return null;
        }
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("data-inline-line", line);
        g.setAttribute("data-y", `${attrs.y}`);
        g.setAttribute("fill", attrs.fill);
        return g;
      },
    });

    const svg = await exportUtils.exportToSvg(
      [textElement()],
      { exportBackground: false, viewBackgroundColor: "#ffffff" },
      null,
    );

    const texts = Array.from(svg.querySelectorAll("text")).map(
      (node) => node.textContent,
    );
    const inline = svg.querySelector("[data-inline-line]");
    expect(texts).toContain("plain line");
    expect(texts).not.toContain(FORMULA_LINE);
    expect(inline?.getAttribute("data-inline-line")).toBe(FORMULA_LINE);
    expect(Number(inline?.getAttribute("data-y"))).toBeGreaterThan(0);
  });

  it("invalidateTextRender drops text canvases and repaints", async () => {
    await render(<Excalidraw />);
    const { h } = window;
    const text = textElement();
    const rectangle = API.createElement({ type: "rectangle", id: "rect" });
    API.setElements([text, rectangle]);

    const [sceneText, sceneRect] = h.elements;
    // the repaint inside act() refills the cache, so watch the drops instead
    const drop = vi.spyOn(elementWithCanvasCache, "delete");
    const nonceBefore = h.app.scene.getSceneNonce();

    act(() => {
      h.app.invalidateTextRender(["math-text"]);
    });

    expect(drop).toHaveBeenCalledWith(sceneText);
    expect(drop).not.toHaveBeenCalledWith(sceneRect);
    expect(h.app.scene.getSceneNonce()).not.toBe(nonceBefore);

    drop.mockClear();
    act(() => {
      h.app.invalidateTextRender(["another-id"]);
    });
    expect(drop).not.toHaveBeenCalled();

    act(() => {
      h.app.invalidateTextRender();
    });
    expect(drop).toHaveBeenCalledWith(sceneText);
    expect(drop).not.toHaveBeenCalledWith(sceneRect);
    drop.mockRestore();
  });
});
