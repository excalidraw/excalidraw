import React from "react";
import { expect } from "vitest";

import { Excalidraw } from "../index";

import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { render, waitFor } from "./test-utils";

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
});
