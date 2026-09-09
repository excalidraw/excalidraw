import React from "react";
import { act, waitFor } from "@testing-library/react";

import { KEYS, applyDarkModeFilter, getFontString } from "@excalidraw/common";
import {
  ensureMathTextProviderLoaded,
  getMathTextSvg,
  measureText,
  measureTextContent,
  newTextElement,
  redrawTextBoundingBox,
  setMathTextProvider,
} from "@excalidraw/element";

import type { MathTextProvider } from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionToggleMathText } from "../actions/actionMathText";
import { createPasteEvent } from "../clipboard";
import { Excalidraw } from "../index";
import { mathJaxMathTextProvider } from "../mathjax";
import * as exportUtils from "../scene/export";

import { API } from "./helpers/api";
import { mockMathTextProvider } from "./helpers/mathTextMock";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { GlobalTestState, render, unmountComponent } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const plainWidth = (element: ExcalidrawTextElement, text: string) =>
  measureText(text, getFontString(element), element.lineHeight).width;

describe("math text (LaTeX)", () => {
  beforeEach(async () => {
    unmountComponent();
    mockMathTextProvider();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    // paste handling requires the pointer to be over the canvas
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
    API.setElements([]);
  });

  afterEach(() => {
    setMathTextProvider(null);
  });

  it("lays out `$…$` text as math once editing is done", async () => {
    const textElement = UI.createElement("text");
    mouse.clickOn(textElement);
    const textarea = await getTextEditor();

    updateTextEditor(textarea, "$x^2$");

    // while editing, the element is laid out as plain text (the textarea
    // shows the LaTeX source)
    let element = h.elements[0] as ExcalidrawTextElement;
    expect(element.originalText).toBe("$x^2$");
    expect(element.width).toBe(plainWidth(element, "$x^2$"));

    Keyboard.exitTextEditor(textarea);

    // mock provider: width = source.length / 2 em, height = 1em
    element = h.elements[0] as ExcalidrawTextElement;
    expect(element.text).toBe("$x^2$");
    expect(element.originalText).toBe("$x^2$");
    expect(element.autoResize).toBe(true);
    expect(element.width).toBe((3 / 2) * element.fontSize);
    expect(element.height).toBe(element.fontSize);

    // re-editing switches back to the plain-text box…
    API.setSelectedElements([element as NonDeleted<ExcalidrawTextElement>]);
    Keyboard.keyPress(KEYS.ENTER);
    const textarea2 = await getTextEditor();
    element = h.elements[0] as ExcalidrawTextElement;
    expect(element.width).toBe(plainWidth(element, "$x^2$"));

    // …and submitting restores the equation box
    Keyboard.exitTextEditor(textarea2);
    element = h.elements[0] as ExcalidrawTextElement;
    expect(element.width).toBe((3 / 2) * element.fontSize);
    expect(element.height).toBe(element.fontSize);
  });

  it("keeps plain text unaffected", async () => {
    const textElement = UI.createElement("text");
    mouse.clickOn(textElement);
    const textarea = await getTextEditor();

    updateTextEditor(textarea, "x^2");
    Keyboard.exitTextEditor(textarea);

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.width).toBe(plainWidth(element, "x^2"));
  });

  it("creates math text elements with the equation dimensions", () => {
    const element = newTextElement({
      x: 0,
      y: 0,
      text: "$$\\frac{a}{b}$$",
      fontSize: 20,
    });
    // "\frac{a}{b}" → 11 chars / 2 em; display → 1.5em
    expect(element.width).toBe(110);
    expect(element.height).toBe(30);
    expect(element.text).toBe("$$\\frac{a}{b}$$");
    expect(element.originalText).toBe("$$\\frac{a}{b}$$");
  });

  it("inlines the typeset equation in SVG exports", async () => {
    const element = API.createElement({
      type: "text",
      text: "$x^2$",
      fontSize: 20,
      strokeColor: "#e03131",
    });

    const svg = await exportUtils.exportToSvg(
      [element],
      { exportBackground: false, viewBackgroundColor: "#ffffff" },
      null,
    );

    const mathNode = svg.querySelector(`g > svg[viewBox]`);
    expect(mathNode).not.toBe(null);
    expect(mathNode!.getAttribute("width")).toBe(`${element.width}`);
    expect(mathNode!.getAttribute("height")).toBe(`${element.height}`);
    expect(mathNode!.getAttribute("color")).toBe("#e03131");
    // no plain <text> fallback for the math element
    expect(svg.querySelector("text")).toBe(null);

    const darkSvg = await exportUtils.exportToSvg(
      [element],
      {
        exportBackground: false,
        viewBackgroundColor: "#ffffff",
        exportWithDarkMode: true,
      },
      null,
    );
    expect(
      darkSvg.querySelector(`g > svg[viewBox]`)!.getAttribute("color"),
    ).toBe(applyDarkModeFilter("#e03131", true));
  });

  it("falls back to plain <text> in SVG exports without a provider", async () => {
    setMathTextProvider(null);
    const element = API.createElement({
      type: "text",
      text: "$x^2$",
      fontSize: 20,
    });

    const svg = await exportUtils.exportToSvg(
      [element],
      { exportBackground: false, viewBackgroundColor: "#ffffff" },
      null,
    );

    expect(svg.querySelector(`g > svg[viewBox]`)).toBe(null);
    expect(svg.querySelector("text")?.textContent).toBe("$x^2$");
  });

  it("pastes a (multi-line) LaTeX block as a single math element", async () => {
    document.dispatchEvent(
      createPasteEvent({ types: { "text/plain": "$$\na \\\\\nb\n$$" } }),
    );

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });

    const element = h.elements[0] as ExcalidrawTextElement;
    expect(element.type).toBe("text");
    expect(element.originalText).toBe("$$\na \\\\\nb\n$$");
    expect(element.text).toBe(element.originalText);
    expect(element.autoResize).toBe(true);
    // "a \\\nb" → 6 chars / 2 em; display → 1.5em
    expect(element.width).toBe(3 * element.fontSize);
    expect(element.height).toBe(1.5 * element.fontSize);
  });

  it("lays out bound math as plain (wrapped) text while the engine loads, then re-lays it out", async () => {
    // a provider that only becomes usable after `load()` resolves
    let loaded = false;
    const loadable: MathTextProvider = {
      isLoaded: () => loaded,
      load: async () => {
        await Promise.resolve();
        loaded = true;
      },
      render: (source, display) => {
        if (!loaded) {
          return null;
        }
        const viewBoxWidth = source.length * 500;
        const viewBoxHeight = display ? 1500 : 1000;
        return {
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -700 ${viewBoxWidth} ${viewBoxHeight}"><path d="M0 0h1v1h-1z"/></svg>`,
          viewBoxWidth,
          viewBoxHeight,
        };
      },
    };
    setMathTextProvider(loadable);

    const container = API.createElement({
      type: "rectangle",
      width: 100,
      height: 50,
    });
    const text = API.createElement({
      type: "text",
      text: "$\\int_0^1 \\frac{\\sin x}{x}dx$",
      fontSize: 20,
      containerId: container.id,
    });
    API.setElements([container, text]);
    API.updateElement(container, {
      boundElements: [{ type: "text", id: text.id }],
    });

    act(() => {
      redrawTextBoundingBox(
        h.elements[1] as ExcalidrawTextElement,
        h.elements[0],
        h.app.scene,
      );
    });

    // while loading: wrapped as plain text → fits the container, which must
    // NOT be grown to the width of the raw LaTeX source
    let boundText = h.elements[1] as ExcalidrawTextElement;
    expect(boundText.text).toContain("\n");
    expect(h.elements[0].width).toBe(100);

    await act(async () => {
      await ensureMathTextProviderLoaded();
    });

    // once loaded, the app re-lays out the candidates from their source
    boundText = h.elements[1] as ExcalidrawTextElement;
    expect(boundText.text).toBe(boundText.originalText);
    // mock provider: 27 chars / 2 em = 270px wide → container grows to fit
    expect(boundText.width).toBe(270);
    expect(h.elements[0].width).toBeGreaterThanOrEqual(270);
  });

  describe("LaTeX toggle (properties panel)", () => {
    it("wraps selected plain text in $$…$$ and unwraps it back", () => {
      const element = API.createElement({
        type: "text",
        text: "x^2",
        fontSize: 20,
      });
      API.setElements([element]);
      API.setSelectedElements([element]);

      API.executeAction(actionToggleMathText);

      let text = h.elements[0] as ExcalidrawTextElement;
      expect(text.originalText).toBe("$$x^2$$");
      expect(text.text).toBe("$$x^2$$");
      // mock provider: 3 chars / 2 em × 20px, display → 1.5em
      expect(text.width).toBe(30);
      expect(text.height).toBe(30);
      expect(text.autoResize).toBe(true);

      API.executeAction(actionToggleMathText);

      text = h.elements[0] as ExcalidrawTextElement;
      expect(text.originalText).toBe("x^2");
      expect(text.text).toBe("x^2");
      expect(text.width).toBe(plainWidth(text, "x^2"));
    });

    it("toggles the bound text of a selected container", () => {
      const container = API.createElement({
        type: "rectangle",
        width: 200,
        height: 100,
      });
      const boundText = API.createElement({
        type: "text",
        text: "\\frac{a}{b}",
        fontSize: 20,
        containerId: container.id,
      });
      API.setElements([container, boundText]);
      API.updateElement(container, {
        boundElements: [{ type: "text", id: boundText.id }],
      });
      API.setSelectedElements([container]);

      API.executeAction(actionToggleMathText);

      const text = h.elements[1] as ExcalidrawTextElement;
      expect(text.originalText).toBe("$$\\frac{a}{b}$$");
      expect(text.text).toBe("$$\\frac{a}{b}$$");
      // 11 chars / 2 em × 20px
      expect(text.width).toBe(110);
      expect(text.containerId).toBe(container.id);
    });

    it("does nothing while a text is being edited", async () => {
      const textElement = UI.createElement("text");
      mouse.clickOn(textElement);
      const textarea = await getTextEditor();
      updateTextEditor(textarea, "x^2");

      API.executeAction(actionToggleMathText);
      expect((h.elements[0] as ExcalidrawTextElement).originalText).toBe("x^2");

      Keyboard.exitTextEditor(textarea);
    });
  });
});

describe("math text (LaTeX) — real MathJax provider", () => {
  const textProps = {
    fontSize: 100,
    fontFamily: 5 as const,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  };

  beforeAll(async () => {
    setMathTextProvider(mathJaxMathTextProvider);
    // kicks off the (lazy) MathJax load
    measureTextContent("$x$", textProps);
    await ensureMathTextProviderLoaded();
  }, 30_000);

  afterAll(() => {
    setMathTextProvider(null);
  });

  it("typesets TeX into size-independent, self-contained SVG", () => {
    // MathJax TeX font: "x" is 572/1000 em wide, 453/1000 em tall
    const metrics = measureTextContent("$x$", textProps);
    expect(metrics.isMath).toBe(true);
    expect(metrics.width).toBeCloseTo(57.2, 1);
    expect(metrics.height).toBeCloseTo(45.3, 1);

    // scales linearly with the font size
    const half = measureTextContent("$x$", { ...textProps, fontSize: 50 });
    expect(half.width).toBeCloseTo(28.6, 1);

    const svg = getMathTextSvg(
      { id: "el", text: "$$\\frac{a}{b}$$" },
      "#e03131",
    )!;
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain('color="#e03131"');
    expect(svg).toContain("<path");
    // glyphs are inlined (fontCache: "none") → no ids/references to collide
    expect(svg).not.toContain("<use");
    expect(svg).not.toMatch(/\sid="/);
    expect(svg).not.toContain("xlink");
    // no inline style / ex-based size left on the root
    expect(svg).not.toMatch(/^<svg[^>]*style=/);
    expect(svg).not.toMatch(/^<svg[^>]*width="[^"]*ex"/);
  });

  it("falls back to plain text on invalid TeX", () => {
    expect(measureTextContent("$\\frac{$", textProps).isMath).toBe(false);
    expect(getMathTextSvg({ id: "el", text: "$\\frac{$" }, "#000")).toBe(null);
  });
});
