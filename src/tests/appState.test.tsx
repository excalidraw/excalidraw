import { queryByTestId, render, waitFor } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "../constants";
import { Pointer, UI } from "./helpers/ui";
import { ExcalidrawTextElement } from "../element/types";

const { h } = window;

describe("appState", () => {
  it("drag&drop file doesn't reset non-persisted appState", async () => {
    const defaultAppState = getDefaultAppState();
    const exportBackground = !defaultAppState.exportBackground;

    await render(<ExcalidrawApp />, {
      localStorageData: {
        appState: {
          exportBackground,
          viewBackgroundColor: "#F00",
        },
      },
    });

    await waitFor(() => {
      expect(h.state.exportBackground).toBe(exportBackground);
      expect(h.state.viewBackgroundColor).toBe("#F00");
    });

    API.drop(
      new Blob(
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
    );

    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      // non-imported prop → retain
      expect(h.state.exportBackground).toBe(exportBackground);
      // imported prop → overwrite
      expect(h.state.viewBackgroundColor).toBe("#000");
    });
  });

  it("changing fontSize with text tool selected (no element created yet)", async () => {
    const { container } = await render(<ExcalidrawApp />, {
      localStorageData: {
        appState: {
          currentItemFontSize: 30,
        },
      },
    });

    UI.clickTool("text");

    expect(h.state.currentItemFontSize).toBe(30);
    queryByTestId(container, "fontSize-small")!.click();
    expect(h.state.currentItemFontSize).toBe(16);

    const mouse = new Pointer("mouse");

    mouse.clickAt(100, 100);

    expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(16);
  });
});
