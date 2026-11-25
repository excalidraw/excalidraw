import React from "react";
import { vi } from "vitest";

import * as MermaidToExcalidrawLib from "@excalidraw/mermaid-to-excalidraw";

import {
  getCommonBounds,
  getLineHeightInPx,
  setCustomTextMetricsProvider,
} from "@excalidraw/element";

import {
  EDITOR_LS_KEYS,
  KEYS,
  TEXT_VIEWPORT_PADDING,
  TEXT_MAX_WRAP_WIDTH,
  getLineHeight,
} from "@excalidraw/common";

import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { Pointer, Keyboard } from "./helpers/ui";
import {
  fireEvent,
  render,
  waitFor,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("./helpers/mocks");

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
    throttleRAF: mockThrottleRAF,
  };
});

const sendPasteEvent = (text: string) => {
  const clipboardEvent = createPasteEvent({
    types: {
      "text/plain": text,
    },
  });
  document.dispatchEvent(clipboardEvent);
};

const pasteWithCtrlCmdShiftV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const pasteWithCtrlCmdV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

beforeEach(async () => {
  unmountComponent();

  localStorage.clear();

  mouse.reset();

  await render(
    <Excalidraw
      autoFocus={true}
      handleKeyboardGlobally={true}
      initialData={{ appState: { zoom: { value: 1 as NormalizedZoomValue } } }}
    />,
  );
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("general paste behavior", () => {
  it("should randomize seed on paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });
    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).not.toBe(rectangle.seed);
    });
  });

  it("should retain seed on shift-paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });

    // assert we don't randomize seed on shift-paste
    pasteWithCtrlCmdShiftV(clipboardJSON);
    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).toBe(rectangle.seed);
    });
  });
});

/** the toast's button, once it's shown */
const getToastAction = () =>
  waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>(".Toast__action");
    expect(button).not.toBe(null);
    return button!;
  });

const clickToastAction = (button: HTMLButtonElement) => {
  // as a click does
  button.focus();
  fireEvent.click(button);
};

/**
 * pastes a text with Ctrl/Cmd+V, and splits it from the toast (the pasted
 * text, then the lines it's split into, are what's selected)
 */
const pasteAndSplit = async (
  text: string,
  beforeSplit?: (pasted: ExcalidrawTextElement) => void,
) => {
  pasteWithCtrlCmdV(text);
  const button = await getToastAction();
  const pasted = API.getSelectedElement() as ExcalidrawTextElement;
  beforeSplit?.(pasted);
  clickToastAction(button);
  return {
    pasted,
    texts: API.getSelectedElements() as ExcalidrawTextElement[],
  };
};

describe("paste multiline text", () => {
  it("should paste a single element, and offer to split it into an element per line", async () => {
    const text = "sajgfakfn\n\n  aaksfnknas\nakefnkasf\n";
    const { pasted, texts } = await pasteAndSplit(text);
    expect(pasted.originalText).toBe(text.trim());

    // blank lines dropped (the indentation kept), in place of the pasted
    // text, selected
    expect(texts.map((text) => text.originalText)).toEqual([
      "sajgfakfn",
      "  aaksfnknas",
      "akefnkasf",
    ]);
    expect(h.elements.find((el) => el.id === pasted.id)?.isDeleted).toBe(true);
    expect(texts[0].x).toBeCloseTo(pasted.x);
    expect(texts[0].y).toBeCloseTo(pasted.y);
    expect(Object.keys(h.state.selectedElementIds).sort()).toEqual(
      texts.map((text) => text.id).sort(),
    );
    expect(h.state.toast).toBe(null);
    // the button's gone, the focus is back in the editor (to paste again)
    expect(document.activeElement).toBe(
      document.querySelector(".excalidraw-container"),
    );

    // one step to undo
    Keyboard.undo();
    expect(
      h.elements.filter((element) => !element.isDeleted).map((el) => el.id),
    ).toEqual([pasted.id]);
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space the split lines by half a line height, ignoring blank lines", async () => {
    const lineHeightPx = getLineHeightInPx(
      h.app.state.currentItemFontSize,
      getLineHeight(h.state.currentItemFontFamily),
    );
    mouse.moveTo(100, 100);
    const { texts } = await pasteAndSplit("hkhkjhki\njgkjhffjh\n\n\njgkjhffjh");
    expect(texts.length).toBe(3);
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i].y).toBeCloseTo(texts[0].y + lineHeightPx * 1.5 * i);
    }
  });

  it.each(["left", "center", "right"] as const)(
    "should align the split lines as the text is (%s)",
    async (textAlign) => {
      API.setAppState({ currentItemTextAlign: textAlign });
      const { pasted, texts } = await pasteAndSplit("short\nmuch longer line");
      const [short, long] = texts;
      expect(pasted.textAlign).toBe(textAlign);
      expect(short.textAlign).toBe(textAlign);
      expect(long.textAlign).toBe(textAlign);
      expect(short.width).toBeLessThan(long.width);
      const getEdge = (text: ExcalidrawTextElement) =>
        textAlign === "left"
          ? text.x
          : textAlign === "right"
          ? text.x + text.width
          : text.x + text.width / 2;
      expect(getEdge(short)).toBeCloseTo(getEdge(pasted));
      expect(getEdge(long)).toBeCloseTo(getEdge(pasted));
    },
  );

  it("should stack split lines that wrap to different heights without overlap", async () => {
    API.setAppState({
      width: 1000,
      zoom: { value: 8 as NormalizedZoomValue },
    });
    const long =
      "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!";
    const { pasted, texts } = await pasteAndSplit(
      `short\n${long}\n${long} ${long}\nshort`,
    );
    expect(pasted.autoResize).toBe(false);
    // wrapped as they were in the pasted text
    expect(texts.map((text) => text.text).join("\n")).toBe(pasted.text);
    expect(texts.map((text) => text.autoResize)).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(texts[2].height).toBeGreaterThan(texts[1].height);
    const lineGap =
      getLineHeightInPx(texts[0].fontSize, texts[0].lineHeight) / 2;
    for (let i = 1; i < texts.length; i++) {
      expect(texts[i].y).toBeCloseTo(
        texts[i - 1].y + texts[i - 1].height + lineGap,
      );
    }
  });

  it("should keep the split lines wrapped as they were, not wrap them anew", async () => {
    // kerning: a row is narrower than its characters are, one by one — as
    // a long word is measured when it's broken up
    setCustomTextMetricsProvider({
      getLineWidth: (text) => text.length * 10 - Math.max(0, text.length - 1),
    });
    try {
      API.setAppState({
        width: 1000,
        zoom: { value: 8 as NormalizedZoomValue },
      });
      const { pasted, texts } = await pasteAndSplit(
        "abcdefghijklmnopqrstuvwx\nshort",
      );
      // the word's broken up into rows that, measured one character at a
      // time, wouldn't fit the width the text ends up with
      const rows = pasted.text.split("\n");
      expect(rows.length).toBeGreaterThan(2);
      expect(rows[0].length * 10).toBeGreaterThan(pasted.width);
      expect(texts.map((text) => text.text).join("\n")).toBe(pasted.text);
    } finally {
      setCustomTextMetricsProvider(undefined);
    }
  });

  it("should take a split line that's left the frame out of it", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 200,
      y: 240,
      width: 200,
      height: 120,
    });
    API.setElements([frame]);
    // four lines fit the frame, not so half a line height apart
    h.app.viewport.lastPosition.x = 300;
    h.app.viewport.lastPosition.y = 300;
    const { pasted, texts } = await pasteAndSplit("a\nb\nc\nd");
    expect(pasted.frameId).toBe(frame.id);
    expect(texts.map((text) => text.frameId)).toEqual([
      frame.id,
      frame.id,
      frame.id,
      null,
    ]);
  });

  it("should put the split lines in the text's place in the layer order, and let go of arrows bound to it", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const arrow = API.createElement({ type: "arrow" });
    const { texts } = await pasteAndSplit("a\nb", (pasted) => {
      API.setElements([
        {
          ...pasted,
          boundElements: [{ id: arrow.id, type: "arrow" }],
        },
        rectangle,
        {
          ...arrow,
          startBinding: {
            elementId: pasted.id,
            fixedPoint: [0.5, 0.5],
            mode: "orbit",
          },
        },
      ]);
    });
    expect(
      h.elements.filter((element) => !element.isDeleted).map((el) => el.id),
    ).toEqual([...texts.map((text) => text.id), rectangle.id, arrow.id]);
    expect(
      (h.elements.find((el) => el.id === arrow.id) as ExcalidrawArrowElement)
        .startBinding,
    ).toBe(null);
  });

  it("should offer to split the text pasted last only", async () => {
    pasteWithCtrlCmdV("a\nb");
    await waitFor(() => {
      expect(h.state.toast).not.toBe(null);
    });
    // no offer for this one: the one for the text before is gone
    pasteWithCtrlCmdShiftV("c\nd");
    await waitFor(() => {
      expect(h.elements.length).toBe(2);
    });
    expect(h.state.toast).toBe(null);
  });

  it("should tell the rows of a wrapped line with characters that wrapping composes", async () => {
    API.setAppState({
      width: 1000,
      zoom: { value: 8 as NormalizedZoomValue },
    });
    // e + a combining accent: one character in the rows
    const { texts } = await pasteAndSplit(
      "Excalidraw is an opensource virtual cafe\u0301 whiteboard\nTAIL",
    );
    expect(texts.length).toBe(2);
    expect(texts[0].autoResize).toBe(false);
    expect(texts[1].text).toBe("TAIL");
  });

  it("should center the lines a text's pasted split into at the pointer, whatever blank lines it has", async () => {
    localStorage.setItem(EDITOR_LS_KEYS.PASTE_TEXT_AS_LINES, "true");
    h.app.viewport.lastPosition.x = 300;
    h.app.viewport.lastPosition.y = 300;
    pasteWithCtrlCmdV(`first${"\n".repeat(50)}second`);
    await waitFor(() => {
      expect(h.elements.length).toBe(2);
    });
    const [x1, y1, x2, y2] = getCommonBounds(h.elements);
    expect((x1 + x2) / 2).toBeCloseTo(300);
    expect((y1 + y2) / 2).toBeCloseTo(300);
  });

  it("should never paste split into lines on a phone, which shows no toast to have it as one from", async () => {
    unmountComponent();
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        UIOptions={{ getFormFactor: () => "phone" }}
      />,
    );
    fireEvent.resize(window);
    await waitFor(() => expect(h.app.editorInterface.formFactor).toBe("phone"));
    localStorage.setItem(EDITOR_LS_KEYS.PASTE_TEXT_AS_LINES, "true");
    pasteWithCtrlCmdV("a\nb");
    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });
    expect(h.state.toast).toBe(null);
  });

  it("should paste split into lines once a text's been split (in this browser), and as one again once they've been joined", async () => {
    API.setAppState({
      width: 1000,
      zoom: { value: 8 as NormalizedZoomValue },
    });
    const long =
      "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!";
    // spaces at a line's end, too: kept in a single text
    const text = `short  \n\n${long}\nshort`;
    const { pasted } = await pasteAndSplit(text);
    expect(pasted.autoResize).toBe(false);

    // kept in the browser: for an editor mounted after, too
    unmountComponent();
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    API.setAppState({
      width: 1000,
      zoom: { value: 8 as NormalizedZoomValue },
    });

    // not for a plain paste
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ originalText: pasted.originalText }),
      ]);
    });
    expect(h.state.toast).toBe(null);

    // split, offered as one
    pasteWithCtrlCmdV(text);
    const button = await getToastAction();
    expect(button.textContent).toBe("Paste as a single text element");
    const lines = API.getSelectedElements() as ExcalidrawTextElement[];
    expect(lines.map((line) => line.originalText)).toEqual([
      "short",
      long,
      "short",
    ]);

    // replaced with the text as it'd have been pasted as one (the blank
    // line, the spaces, the rows), in their place
    clickToastAction(button);
    const [joined] = API.getSelectedElements() as ExcalidrawTextElement[];
    expect(joined.originalText).toBe(text);
    expect(joined.text).toBe(
      ["short  ", "", lines[1].text, lines[2].text].join("\n"),
    );
    expect(joined.autoResize).toBe(false);
    expect(joined.x).toBeCloseTo(lines[0].x);
    expect(joined.y).toBeCloseTo(lines[0].y);
    expect(document.activeElement).toBe(
      document.querySelector(".excalidraw-container"),
    );
    // one step to undo
    Keyboard.undo();
    expect(API.getSelectedElements().map((element) => element.id)).toEqual(
      lines.map((line) => line.id),
    );

    // pasted as one again
    pasteWithCtrlCmdV(text);
    expect((await getToastAction()).textContent).toBe(
      "Split into separate text elements",
    );
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V, not offering to split it", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
    expect(h.state.toast).toBe(null);
  });
  it("should not make a pasted text wider than the view", async () => {
    API.setAppState({
      width: 1000,
      zoom: { value: 8 as NormalizedZoomValue },
    });
    // the view at 800%, less some room at each side
    const maxWidth = (1000 - 2 * TEXT_VIEWPORT_PADDING) / 8;

    pasteWithCtrlCmdShiftV(
      "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!",
    );
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
    const text = h.elements[0] as ExcalidrawTextElement;
    expect(text.autoResize).toBe(false);
    expect(text.width).toBeLessThanOrEqual(maxWidth);
  });
  it("should wrap a pasted text as a typed one: at TEXT_MAX_WRAP_WIDTH, clear of the full styles panel", async () => {
    unmountComponent();
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        UIOptions={{ getFormFactor: () => "desktop" }}
      />,
    );
    API.setAppState({ width: 1000 });
    // nothing's selected: the panel shows only once the text is in
    expect(
      document.querySelector('[data-viewport-ui-name="stylesPanel"]'),
    ).toBe(null);

    pasteWithCtrlCmdShiftV(
      "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams! Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!",
    );
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
    const text = h.elements[0] as ExcalidrawTextElement;
    expect(text.autoResize).toBe(false);
    // not at half the view…
    expect(text.width).toBeGreaterThan(1000 / 2);
    // …but the view less the panel's room (216, approximately, while never
    // shown) and some room at each side
    expect(text.width).toBeLessThanOrEqual(
      Math.min(1000 - 216 - 2 * TEXT_VIEWPORT_PADDING, TEXT_MAX_WRAP_WIDTH),
    );
  });
  describe("next to the stats panel (desktop)", () => {
    const { getBoundingClientRect } = HTMLElement.prototype;
    /** the stats panel's bottom: it grows to show a selection's properties */
    let getStatsBottom = () => 200;

    beforeEach(async () => {
      unmountComponent();
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          UIOptions={{ getFormFactor: () => "desktop" }}
        />,
      );
      API.setAppState({
        width: 1000,
        height: 800,
        stats: { ...h.state.stats, open: true },
      });
      // the styles panel up to 216px, the stats panel from 700px
      getStatsBottom = () => 200;
      HTMLElement.prototype.getBoundingClientRect = function (
        this: HTMLElement,
      ) {
        switch (this.dataset.viewportUiName) {
          case "stylesPanel":
            return {
              left: 16,
              right: 216,
              width: 200,
              top: 0,
              bottom: 400,
            } as DOMRect;
          case "stats":
            return {
              left: 700,
              right: 904,
              width: 204,
              top: 0,
              bottom: getStatsBottom(),
            } as DOMRect;
        }
        return getBoundingClientRect.call(this);
      };
    });

    afterEach(() => {
      HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    const pasteAt = async (y: number) => {
      API.setSelectedElements([]);
      h.app.viewport.lastPosition.x = 500;
      h.app.viewport.lastPosition.y = y;
      const count = h.elements.length;
      pasteWithCtrlCmdShiftV(
        "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams! Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!",
      );
      await waitFor(() => {
        expect(h.elements.length).toEqual(count + 1);
      });
      return h.elements[count] as ExcalidrawTextElement;
    };
    const getRight = (text: ExcalidrawTextElement) =>
      (text.x + text.width + h.state.scrollX) * h.state.zoom.value;
    // the view less the styles panel's room, and some room at each side
    const maxWidth = 1000 - 216 - 2 * TEXT_VIEWPORT_PADDING;
    // and the stats panel's
    const maxWidthBesideStats = maxWidth - (1000 - 700);

    it("should keep a pasted text clear of the stats panel only where it lands beside it", async () => {
      // below it, it's wrapped past it
      let text = await pasteAt(600);
      expect(text.width).toBeGreaterThan(maxWidthBesideStats);
      expect(text.width).toBeLessThanOrEqual(maxWidth);

      // beside it, it's wrapped, and moved, clear of it
      text = await pasteAt(100);
      expect(text.width).toBeLessThanOrEqual(maxWidthBesideStats);
      expect(getRight(text)).toBeLessThanOrEqual(
        700 - TEXT_VIEWPORT_PADDING + 0.01,
      );
    });

    it("should keep a pasted text clear of the stats panel grown to show it, as one step", async () => {
      getStatsBottom = () =>
        Object.keys(h.state.selectedElementIds).length ? 500 : 200;
      const undoSteps = h.history.undoStack.length;

      // below it as it is before the paste, beside it as it is after
      const text = await pasteAt(350);
      expect(text.width).toBeLessThanOrEqual(maxWidthBesideStats);
      expect(getRight(text)).toBeLessThanOrEqual(
        700 - TEXT_VIEWPORT_PADDING + 0.01,
      );
      expect(h.history.undoStack.length).toBe(undoSteps + 1);
    });
  });
  it("should move a pasted text that wraps into view, not the view", async () => {
    API.setAppState({ width: 1000, height: 800 });
    const { scrollX, scrollY } = h.state;
    // pasted at the pointer, near the bottom-right corner
    h.app.viewport.lastPosition.x = 950;
    h.app.viewport.lastPosition.y = 780;

    pasteWithCtrlCmdShiftV(
      "Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams! Excalidraw is an opensource virtual collaborative whiteboard for sketching hand-drawn like diagrams!",
    );
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
    const text = h.elements[0] as ExcalidrawTextElement;
    expect(text.autoResize).toBe(false);
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);
    // all of it within the view, with room at each side
    const zoom = h.state.zoom.value;
    expect((text.x + scrollX) * zoom).toBeGreaterThanOrEqual(
      TEXT_VIEWPORT_PADDING - 0.01,
    );
    expect((text.x + text.width + scrollX) * zoom).toBeLessThanOrEqual(
      1000 - TEXT_VIEWPORT_PADDING + 0.01,
    );
    expect((text.y + scrollY) * zoom).toBeGreaterThanOrEqual(
      TEXT_VIEWPORT_PADDING - 0.01,
    );
    expect((text.y + text.height + scrollY) * zoom).toBeLessThanOrEqual(
      800 - TEXT_VIEWPORT_PADDING + 0.01,
    );
  });
  it("should not create any element when only new lines in clipboard", async () => {
    const text = "\n\n\n\n";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(async () => {
      await sleep(50);
      expect(h.elements.length).toEqual(0);
    });
  });
});

describe("Paste bound text container", () => {
  const container = {
    type: "ellipse",
    id: "container-id",
    x: 554.984375,
    y: 196.0234375,
    width: 166,
    height: 187.01953125,
    roundness: { type: 2 },
    boundElements: [{ type: "text", id: "text-id" }],
  };
  const textElement = {
    type: "text",
    id: "text-id",
    x: 560.51171875,
    y: 202.033203125,
    width: 154,
    height: 175,
    fontSize: 20,
    fontFamily: 1,
    text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
    baseline: 168,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: container.id,
    originalText:
      "Excalidraw is a virtual opensource whiteboard for sketching hand-drawn like diagrams",
  };

  it("should fix ellipse bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [container, textElement],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(368);
      expect(container.width).toBe(166);
    });
  });

  it("should fix diamond bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [
        {
          ...container,
          type: "diamond",
        },
        textElement,
      ],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(770);
      expect(container.width).toBe(166);
    });
  });
});

describe("pasting & frames", () => {
  it("should add pasted elements to frame under cursor", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[0].index! < frame.index!).toBe(true);
    });
  });

  it("should layer pasted elements above the highest frame child", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      id: "frameChild",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frameChild, frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frameChild.id,
        h.elements[1].id,
        frame.id,
      ]);
      expect(h.elements[1].index! > frameChild.index!).toBe(true);
      expect(h.elements[1].index! < frame.index!).toBe(true);
    });
  });

  it("should preserve denormalized pasted frame child order", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [frame, frameChild],
      files: null,
    });

    mouse.moveTo(200, 200);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(frame.type);
      expect(h.elements[1].type).toBe(frameChild.type);
      expect(h.elements[1].frameId).toBe(h.elements[0].id);
    });
  });

  it("should remove element from frame when pasted outside", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      frameId: frame.id,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(150, 150);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(null);
    });
  });

  it("should filter out elements not overlapping frame", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(null);
    });
  });

  it("should not filter out elements not overlapping frame if part of group", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
      groupIds: ["g1"],
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].type).toBe(rect2.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements[2].id).toBe(frame.id);
    });
  });

  it("should not filter out other frames and their children", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });

    const frame2 = API.createElement({
      type: "frame",
      width: 75,
      height: 75,
      x: 0,
      y: 0,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 55,
      y: 55,
      frameId: frame2.id,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2, frame2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(4);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(h.elements[3].id);
      expect(h.elements[3].type).toBe(frame2.type);
      expect(h.elements[3].frameId).toBe(null);
    });
  });
});

describe("clipboard - pasting mermaid definition", () => {
  beforeAll(() => {
    mockMermaidToExcalidraw({
      parseMermaidToExcalidraw: async (definition) => {
        const lines = definition.split("\n");
        return new Promise((resolve, reject) => {
          if (lines.some((line) => line === "flowchart TD")) {
            resolve({
              elements: [
                {
                  id: "rect1",
                  type: "rectangle",
                  groupIds: [],
                  x: 0,
                  y: 0,
                  width: 69.703125,
                  height: 44,
                  strokeWidth: 2,
                  label: {
                    groupIds: [],
                    text: "A",
                    fontSize: 20,
                  },
                  link: null,
                },
              ],
            });
          } else {
            reject(new Error("ERROR"));
          }
        });
      },
    });
  });

  it("should detect and paste as mermaid", async () => {
    const text = "flowchart TD\nA";

    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "rectangle" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
    expect(
      MermaidToExcalidrawLib.parseMermaidToExcalidraw,
    ).toHaveBeenCalledWith(text, { elbow: { flowchart: true } });
  });

  it("should support directives", async () => {
    const text = "%%{init: { **config** } }%%\nflowchart TD\nA";

    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "rectangle" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
  });

  it("should paste as normal text if invalid mermaid", async () => {
    const text = "flowchart TD xx\nA";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({ type: "text", text: "flowchart TD xx\nA" }),
      ]);
    });
  });
});

describe("copy and cut events", () => {
  const dispatchClipboardEvent = (type: "copy" | "cut") => {
    const clipboardData = new DataTransfer();
    document.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clipboardData,
      }),
    );
    return clipboardData;
  };

  it("should copy the selection on a copy event, and cut it on a cut event", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    const copied = dispatchClipboardEvent("copy");
    await waitFor(() => {
      expect(JSON.parse(copied.getData("text/plain")).elements).toEqual([
        expect.objectContaining({ id: rectangle.id }),
      ]);
    });
    expect(h.elements[0].isDeleted).toBe(false);

    const cut = dispatchClipboardEvent("cut");
    await waitFor(() => {
      expect(h.elements[0].isDeleted).toBe(true);
    });
    expect(JSON.parse(cut.getData("text/plain")).elements).toEqual([
      expect.objectContaining({ id: rectangle.id }),
    ]);
  });
});

describe("paste routing", () => {
  it("should paste embed code with its loader <script> on a separate line as an embeddable", async () => {
    pasteWithCtrlCmdV(
      `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/BsOGulcndj-/?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14"><div style="padding:16px;"> <a href="https://www.instagram.com/p/BsOGulcndj-/?utm_source=ig_embed&amp;utm_campaign=loading" target="_blank">View this post on Instagram</a></div></blockquote>
<script async src="//www.instagram.com/embed.js"></script>`,
    );
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "embeddable",
          link: "https://www.instagram.com/p/BsOGulcndj-/?utm_source=ig_embed&amp;utm_campaign=loading",
        }),
      ]);
    });
  });

  it("should leave a paste to the host when its onPaste returns false", async () => {
    unmountComponent();
    const onPaste = vi.fn(() => false);
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        onPaste={onPaste}
      />,
    );

    pasteWithCtrlCmdV("hello");
    await waitFor(() => {
      expect(onPaste).toHaveBeenCalledWith(
        expect.objectContaining({ text: "hello" }),
        expect.anything(),
      );
    });
    await sleep(50);
    expect(h.elements.length).toBe(0);
  });

  it("should open the charts dialog for a pasted spreadsheet", async () => {
    pasteWithCtrlCmdV("time\tvalue\n1\t10\n2\t20\n3\t30");
    await waitFor(() => {
      expect(h.state.openDialog?.name).toBe("charts");
    });
    expect(h.elements.length).toBe(0);
  });

  it("should paste the text of mixed content when images can't be inserted", async () => {
    unmountComponent();
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        UIOptions={{ tools: { image: false } }}
      />,
    );

    document.dispatchEvent(
      createPasteEvent({
        types: {
          "text/html":
            '<p>hello</p><img src="https://example.com/a.png" /><p>world</p>',
        },
      }),
    );
    await waitFor(() => {
      expect(h.elements.map((element) => (element as any).text)).toEqual([
        "hello\n\nworld",
      ]);
    });
  });
});
