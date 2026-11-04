import { FONT_FAMILY, KEYS } from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import {
  actionChangeFontFamily,
  actionChangeFontSize,
  actionChangeStrokeColor,
  actionChangeTextHighlightColor,
  actionToggleTextStyle,
} from "../actions";
import { exportScene } from "../scene/export";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { getTextEditor, updateTextEditor } from "../tests/queries/dom";
import { act, fireEvent, render } from "../tests/test-utils";

const { h } = window;

const getText = (id: string) =>
  h.elements.find((element) => element.id === id) as ExcalidrawTextElement;

describe("rich text (styling a portion of a text)", () => {
  let text: NonDeleted<ExcalidrawTextElement>;

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    text = API.createElement({
      type: "text",
      text: "Hello world",
      strokeColor: "#1e1e1e",
    }) as NonDeleted<ExcalidrawTextElement>;
    API.setElements([text]);
    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);
  });

  const selectInEditor = async (start: number, end: number) => {
    const editor = await getTextEditor();
    act(() => {
      editor.focus();
      editor.setSelectionRange(start, end);
    });
    return editor;
  };

  it("takes the pointer and lets text be selected with it", async () => {
    // the editor root turns both off, and a contenteditable (unlike a
    // textarea) would inherit that: presses would go through to the canvas
    const editor = await getTextEditor();
    expect(editor.style.pointerEvents).toBe("auto");
    expect(editor.style.userSelect).toBe("text");
  });

  it("never cuts the text off, and draws a uniform selection itself", async () => {
    const editor = await getTextEditor();
    expect(editor.style.overflow).toBe("visible");
    // the browser's highlight (as tall as each font's glyphs) is hidden in
    // favor of the selection layer's full-line bands
    expect(
      editor.classList.contains("excalidraw-wysiwyg--uniform-selection"),
    ).toBe(true);
    expect(
      editor.parentElement?.querySelector(".excalidraw-wysiwyg-selection"),
    ).not.toBe(null);
  });

  it("sizes only the selected portion, keeping lines as tall as the largest", async () => {
    await selectInEditor(0, 5);
    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
    });

    const updated = getText(text.id);
    expect(updated.fontSize).toBe(text.fontSize);
    expect(updated.spans).toEqual([{ start: 0, end: 5, fontSize: 36 }]);
    // the one line is as tall as the larger text
    expect(updated.height).toBeCloseTo(36 * updated.lineHeight);
    // smaller text inside keeps its span from sizing the line down
    const editor = await getTextEditor();
    const span = editor.querySelector<HTMLElement>("span[data-rt]");
    expect(span?.style.fontSize).toBe("36px");
  });

  it("scales the selected portion's size with the font size shortcuts", async () => {
    const editor = await selectInEditor(6, 11);
    fireEvent.keyDown(editor, {
      key: KEYS.CHEVRON_RIGHT,
      ctrlKey: true,
      shiftKey: true,
    });
    expect(getText(text.id).fontSize).toBe(text.fontSize);
    expect(getText(text.id).spans).toEqual([
      { start: 6, end: 11, fontSize: Math.round(text.fontSize * 1.1) },
    ]);
  });

  it("highlights the selected portion, or the whole text", async () => {
    await selectInEditor(0, 5);
    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlightColor, "ui", {
        color: "#ffec99",
      });
    });
    expect(getText(text.id).spans).toEqual([
      { start: 0, end: 5, highlightColor: "#ffec99" },
    ]);

    // nothing selected: the whole text
    await selectInEditor(2, 2);
    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlightColor, "ui", {
        color: "#b2f2bb",
      });
    });
    expect(getText(text.id).spans).toEqual([
      { start: 0, end: 11, highlightColor: "#b2f2bb" },
    ]);

    // transparent removes it
    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlightColor, "ui", {
        color: "transparent",
      });
    });
    expect(getText(text.id).spans ?? null).toBe(null);
  });

  it("exports highlights and sizes to SVG", async () => {
    await selectInEditor(6, 11);
    act(() => {
      h.app.actionManager.executeAction(actionChangeTextHighlightColor, "ui", {
        color: "#ffec99",
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionChangeFontSize, "ui", 36);
    });
    Keyboard.exitTextEditor(await getTextEditor());

    const svg = await exportScene({
      type: "svg",
      data: { elements: getNonDeletedElements(h.elements), files: null },
    });
    expect(svg.querySelector("rect[fill='#ffec99']")).not.toBe(null);
    expect(
      Array.from(svg.querySelectorAll("tspan")).map((tspan) =>
        tspan.getAttribute("font-size"),
      ),
    ).toEqual([null, "36px"]);
  });

  it("colors only the selected portion", async () => {
    await selectInEditor(6, 11);

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });

    const updated = getText(text.id);
    expect(updated.strokeColor).toBe("#1e1e1e");
    expect(updated.spans).toEqual([
      { start: 6, end: 11, strokeColor: "#e03131" },
    ]);

    // the editor shows it as a styled <span>
    const editor = await getTextEditor();
    const span = editor.querySelector<HTMLElement>("span[data-rt]");
    expect(span?.textContent).toBe("world");
    expect(span?.style.color).not.toBe("");
  });

  it("sets the font and bold of the selected portion only", async () => {
    await selectInEditor(0, 5);

    act(() => {
      h.app.actionManager.executeAction(actionChangeFontFamily, "ui", {
        currentItemFontFamily: FONT_FAMILY.Nunito,
      } as any);
    });
    act(() => {
      h.app.actionManager.executeAction(actionToggleTextStyle, "ui", "bold");
    });

    const updated = getText(text.id);
    expect(updated.fontFamily).toBe(text.fontFamily);
    expect(updated.spans).toEqual([
      { start: 0, end: 5, fontFamily: FONT_FAMILY.Nunito, bold: true },
    ]);
  });

  it("toggles styles with keyboard shortcuts inside the editor", async () => {
    const editor = await selectInEditor(0, 5);

    fireEvent.keyDown(editor, { key: "i", ctrlKey: true });
    expect(getText(text.id).spans).toEqual([
      { start: 0, end: 5, italic: true },
    ]);

    fireEvent.keyDown(editor, { key: "i", ctrlKey: true });
    expect(getText(text.id).spans ?? null).toBe(null);
  });

  it("keeps styled portions in place while typing elsewhere", async () => {
    await selectInEditor(6, 11);
    act(() => {
      h.app.actionManager.executeAction(
        actionToggleTextStyle,
        "ui",
        "underline",
      );
    });

    const editor = await getTextEditor();
    updateTextEditor(editor, "Hello big world");
    Keyboard.exitTextEditor(editor);

    const updated = getText(text.id);
    expect(updated.originalText).toBe("Hello big world");
    expect(updated.spans).toEqual([{ start: 10, end: 15, underline: true }]);
  });

  it("colors the whole text when nothing is selected, dropping overrides", async () => {
    await selectInEditor(6, 11);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });
    await selectInEditor(3, 3);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#2f9e44",
      });
    });

    const updated = getText(text.id);
    expect(updated.strokeColor).toBe("#2f9e44");
    expect(updated.spans ?? null).toBe(null);
  });

  it("exports styled portions to SVG as <tspan>s", async () => {
    await selectInEditor(6, 11);
    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        color: "#e03131",
      });
    });
    const editor = await getTextEditor();
    Keyboard.exitTextEditor(editor);

    const svg = await exportScene({
      type: "svg",
      data: { elements: getNonDeletedElements(h.elements), files: null },
    });
    const tspans = Array.from(svg.querySelectorAll("tspan"));
    expect(tspans.map((tspan) => tspan.textContent)).toEqual([
      "Hello ",
      "world",
    ]);
    expect(tspans[1].getAttribute("fill")).toBe("#e03131");
  });
});
