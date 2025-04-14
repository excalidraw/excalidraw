import React from "react";
import { vi } from "vitest";

import { getLineHeightInPx } from "@excalidraw/element/textMeasurements";

import { KEYS, arrayToMap, getLineHeight } from "@excalidraw/common";

import { getElementBounds } from "@excalidraw/element/bounds";

import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { Pointer, Keyboard } from "./helpers/ui";
import {
  render,
  waitFor,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module: any = await importOriginal();
  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
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

describe("paste text as single lines", () => {
  it("should create an element for each line when copying with Ctrl/Cmd+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(text.split("\n").length);
    });
  });

  it("should ignore empty lines when creating an element for each line", async () => {
    const text = "\n\nsajgfakfn\n\n\naaksfnknas\n\nakefnkasf\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(3);
    });
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space items correctly", async () => {
    const elementsMap = arrayToMap(h.elements);

    const text = "hkhkjhki\njgkjhffjh\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      for (let i = 1; i < h.elements.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [fx, elY] = getElementBounds(h.elements[i], elementsMap);
        expect(elY).toEqual(firstElY + lineHeightPx * i);
      }
    });
  });

  it("should leave a space for blank new lines", async () => {
    const elementsMap = arrayToMap(h.elements);
    const text = "hkhkjhki\n\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);

    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [lx, lastElY] = getElementBounds(h.elements[1], elementsMap);
      expect(lastElY).toEqual(firstElY + lineHeightPx * 2);
    });
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
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
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
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
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
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
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(frame.id);
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
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
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
      expect(h.elements.length).toEqual(2);
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "flowchart TD xx" }),
          expect.objectContaining({ type: "text", text: "A" }),
        ]),
      );
    });
  });
});
