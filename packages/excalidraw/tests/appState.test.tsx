import React from "react";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { fireEvent, queryByTestId, render, waitFor } from "./test-utils";

const { h } = window;

describe("appState", () => {
  it("drag&drop file doesn't reset non-persisted appState", async () => {
    const defaultAppState = getDefaultAppState();
    const exportBackground = !defaultAppState.exportBackground;

    await render(
      <Excalidraw
        initialData={{
          appState: {
            exportBackground,
            viewBackgroundColor: "#F00",
          },
        }}
      />,
      {},
    );

    await waitFor(() => {
      expect(h.state.exportBackground).toBe(exportBackground);
      expect(h.state.viewBackgroundColor).toBe("#F00");
    });

    await API.drop([
      {
        kind: "file",
        file: new Blob(
          [
            JSON.stringify({
              type: EXPORT_DATA_TYPES.excalidraw,
              appState: {
                viewBackgroundColor: "#000",
              },
              elements: [API.createElement({ type: "rectangle", id: "A" })],
            }),
          ],
          { type: MIME_TYPES.json },
        ),
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      // non-imported prop → retain
      expect(h.state.exportBackground).toBe(exportBackground);
      // imported prop → overwrite
      expect(h.state.viewBackgroundColor).toBe("#000");
    });
  });

  it("changing fontSize with text tool selected (no element created yet)", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          appState: {
            currentItemFontSize: 30,
          },
        }}
      />,
    );

    UI.clickTool("text");

    expect(h.state.currentItemFontSize).toBe(30);
    fireEvent.click(queryByTestId(container, "fontSize-small")!);
    expect(h.state.currentItemFontSize).toBe(16);

    const mouse = new Pointer("mouse");

    mouse.clickAt(100, 100);

    expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(16);
  });

  it("changing fontSize to veryLarge and XXL with text tool selected", async () => {
    const { container } = await render(<Excalidraw />, {});

    UI.clickTool("text");

    // veryLarge (36)
    fireEvent.click(queryByTestId(container, "fontSize-veryLarge")!);
    expect(h.state.currentItemFontSize).toBe(36);
    const mouse1 = new Pointer("mouse");
    mouse1.clickAt(150, 120);
    {
      const lastElement = h.elements.at(-1) as ExcalidrawTextElement;
      expect(lastElement.fontSize).toBe(36);
    }

    // switch back to text tool to set XXL before creating another element
    UI.clickTool("text");
    fireEvent.click(queryByTestId(container, "fontSize-xxl")!);
    expect(h.state.currentItemFontSize).toBe(48);
    const mouse2 = new Pointer("mouse");
    mouse2.clickAt(220, 180);
    {
      const lastElement = h.elements.at(-1) as ExcalidrawTextElement;
      expect(lastElement.fontSize).toBe(48);
    }
  });
});
