import { expect, vi } from "vitest";

import { Excalidraw } from "../index";

import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { render, waitFor } from "./test-utils";
import { convertMermaidToExcalidraw } from "../components/TTDDialog/common";

// Mock CodeMirror deps so the dynamic import of CodeMirrorEditor fails,
// causing TTDDialogInput to fall back to <textarea> in tests.
vi.mock("@codemirror/view", () => ({}));
vi.mock("@codemirror/state", () => ({}));
vi.mock("@codemirror/language", () => ({}));
vi.mock("@lezer/highlight", () => ({}));

mockMermaidToExcalidraw({
  mockRef: true,
  parseMermaidToExcalidraw: async (definition) => {
    const firstLine = definition.split("\n")[0];
    return new Promise((resolve, reject) => {
      if (firstLine === "flowchart TD") {
        resolve({
          elements: [
            {
              id: "Start",
              type: "rectangle",
              groupIds: [],
              x: 0,
              y: 0,
              width: 69.703125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Start",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Stop",
              type: "rectangle",
              groupIds: [],
              x: 2.7109375,
              y: 94,
              width: 64.28125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Stop",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Start_Stop",
              type: "arrow",
              groupIds: [],
              x: 34.852,
              y: 44,
              strokeWidth: 2,
              points: [
                [0, 0],
                [0, 50],
              ],
              roundness: {
                type: 2,
              },
              start: {
                id: "Start",
              },
              end: {
                id: "Stop",
              },
            },
          ],
        });
      } else {
        reject(new Error("ERROR"));
      }
    });
  },
});

describe("Test <MermaidToExcalidraw/>", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: { name: "ttd", tab: "mermaid" },
          },
        }}
      />,
    );
  });

  it("should open mermaid popup when active tool is mermaid", async () => {
    const dialog = document.querySelector(".ttd-dialog")!;
    await waitFor(() => expect(dialog.querySelector("canvas")).not.toBeNull());
    expect(dialog.outerHTML).toMatchSnapshot();
  });

  it("should show error in preview when mermaid library throws error", async () => {
    const dialog = document.querySelector(".ttd-dialog")!;

    expect(dialog).not.toBeNull();

    const selector = ".ttd-dialog-input";
    let editor = await getTextEditor({ selector, waitForEditor: true });

    expect(dialog.querySelector('[data-testid="mermaid-error"]')).toBeNull();

    expect(editor.textContent).toMatchSnapshot();

    updateTextEditor(editor, "flowchart TD1");
    editor = await getTextEditor({ selector, waitForEditor: false });

    expect(editor.textContent).toBe("flowchart TD1");
    expect(
      dialog.querySelector('[data-testid="mermaid-error"]'),
    ).toMatchInlineSnapshot("null");
  });

  it("should replace <br> with \n in text elements and measure new dimensions", async () => {
    const data = {
      current: {
        elements: [],
        files: null,
      },
    };
    const canvasRef = {
      current: document.createElement("div"),
    };
    const mockParent = document.createElement("div");
    mockParent.appendChild(canvasRef.current);
    Object.defineProperty(mockParent, "offsetWidth", { value: 500 });
    Object.defineProperty(mockParent, "offsetHeight", { value: 500 });

    const mockLib = {
      api: Promise.resolve({
        parseMermaidToExcalidraw: async () => ({
          elements: [
            {
              id: "text1",
              type: "text",
              text: "Hello<br>World",
              originalText: "Hello<br>World",
              fontSize: 20,
              fontFamily: 1,
            },
          ],
        }),
      }),
    };

    const result = await convertMermaidToExcalidraw({
      canvasRef,
      mermaidToExcalidrawLib: mockLib as any,
      mermaidDefinition: "graph TD",
      setError: () => {},
      data: data as any,
      theme: "light",
    });

    expect(result.success).toBe(true);
    const textElement = data.current.elements.find((el) => el.type === "text") as any;
    expect(textElement).not.toBeUndefined();
    expect(textElement.text).toBe("Hello\nWorld");
    expect(textElement.originalText).toBe("Hello\nWorld");
    expect(textElement.width).toBeGreaterThan(0);
    expect(textElement.height).toBeGreaterThan(0);
  });
});
