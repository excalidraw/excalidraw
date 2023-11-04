import { act, fireEvent, render } from "./test-utils";
import { Excalidraw } from "../packages/excalidraw/index";
import React from "react";
import { expect, vi } from "vitest";
import * as MermaidToExcalidraw from "@excalidraw/mermaid-to-excalidraw";
import { getTextEditor, updateTextEditor } from "./queries/dom";

vi.mock("@excalidraw/mermaid-to-excalidraw", async (importActual) => {
  const module = (await importActual()) as any;

  return {
    __esModule: true,
    ...module,
  };
});
const parseMermaidToExcalidrawSpy = vi.spyOn(
  MermaidToExcalidraw,
  "parseMermaidToExcalidraw",
);

parseMermaidToExcalidrawSpy.mockImplementation(
  async (
    definition: string,
    options?: MermaidToExcalidraw.MermaidOptions | undefined,
  ) => {
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
);

vi.spyOn(React, "useRef").mockReturnValue({
  current: {
    parseMermaidToExcalidraw: parseMermaidToExcalidrawSpy,
  },
});

describe("Test <MermaidToExcalidraw/>", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: "mermaid",
          },
        }}
      />,
    );
  });

  it("should open mermaid popup when active tool is mermaid", async () => {
    const dialog = document.querySelector(".dialog-mermaid")!;

    expect(dialog.outerHTML).toMatchSnapshot();
  });

  it("should close the popup and set the tool to selection when close button clicked", () => {
    const dialog = document.querySelector(".dialog-mermaid")!;
    const closeBtn = dialog.querySelector(".Dialog__close")!;
    fireEvent.click(closeBtn);
    expect(document.querySelector(".dialog-mermaid")).toBe(null);
    expect(window.h.state.activeTool).toStrictEqual({
      customType: null,
      lastActiveTool: null,
      locked: false,
      type: "selection",
    });
  });

  it("should show error in preview when mermaid library throws error", async () => {
    const dialog = document.querySelector(".dialog-mermaid")!;
    const selector = ".dialog-mermaid-panels-text textarea";
    let editor = await getTextEditor(selector, false);

    expect(dialog.querySelector('[data-testid="mermaid-error"]')).toBeNull();

    expect(editor.textContent).toMatchInlineSnapshot(`
      "flowchart TD
       A[Christmas] -->|Get money| B(Go shopping)
       B --> C{Let me think}
       C -->|One| D[Laptop]
       C -->|Two| E[iPhone]
       C -->|Three| F[Car]"
    `);

    await act(async () => {
      updateTextEditor(editor, "flowchart TD1");
      await new Promise((cb) => setTimeout(cb, 0));
    });
    editor = await getTextEditor(selector, false);

    expect(editor.textContent).toBe("flowchart TD1");
    expect(dialog.querySelector('[data-testid="mermaid-error"]'))
      .toMatchInlineSnapshot(`
        <div
          class="mermaid-error"
          data-testid="mermaid-error"
        >
          Error! 
          <p>
            ERROR
          </p>
        </div>
      `);
  });
});
