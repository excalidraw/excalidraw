import React from "react";

import { EXPORT_DATA_TYPES, MIME_TYPES } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { clearAppStateForLocalStorage, getDefaultAppState } from "../appState";
import { Excalidraw, MainMenu } from "../index";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import {
  fireEvent,
  queryByTestId,
  render,
  toggleMenu,
  waitFor,
} from "./test-utils";

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

  it("uses viewport-relative font-size presets without resizing on zoom", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          appState: {
            viewportBasedFontSizingEnabled: true,
          },
        }}
      />,
    );

    API.setAppState({
      height: 1200,
      zoom: { value: getNormalizedZoom(2) },
    });
    UI.clickTool("text");

    fireEvent.click(queryByTestId(container, "fontSize-small")!);
    expect(h.state.currentItemFontSize).toBe(12);
    expect(h.state.currentItemFontSizePreset).toBe("sm");

    fireEvent.click(queryByTestId(container, "fontSize-medium")!);
    expect(h.state.currentItemFontSize).toBe(24);
    expect(h.state.currentItemFontSizePreset).toBe("md");

    fireEvent.click(queryByTestId(container, "fontSize-large")!);
    expect(h.state.currentItemFontSize).toBe(36);
    expect(h.state.currentItemFontSizePreset).toBe("lg");

    fireEvent.click(queryByTestId(container, "fontSize-veryLarge")!);
    expect(h.state.currentItemFontSize).toBe(48);
    expect(h.state.currentItemFontSizePreset).toBe("xl");

    const mouse = new Pointer("mouse");
    mouse.clickAt(100, 100);
    const editor = await getTextEditor();
    updateTextEditor(editor, "first");
    Keyboard.exitTextEditor(editor);

    expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(48);
    expect(queryByTestId(container, "fontSize-veryLarge")).not.toBeChecked();

    API.setSelectedElements([]);
    UI.clickTool("text");
    expect(queryByTestId(container, "fontSize-veryLarge")).toBeChecked();

    // The app-wide XL preset is resolved again at the new zoom for new text.
    API.setAppState({
      zoom: { value: getNormalizedZoom(1) },
    });
    mouse.clickAt(300, 300);

    expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(48);
    expect((h.elements[1] as ExcalidrawTextElement).fontSize).toBe(96);
    expect(h.state.currentItemFontSizePreset).toBe("xl");
    expect(
      clearAppStateForLocalStorage(h.state).currentItemFontSizePreset,
    ).toBe("xl");
  });

  it("toggles and persists viewport-based font sizing as a preference", async () => {
    const { container } = await render(
      <Excalidraw>
        <MainMenu>
          <MainMenu.DefaultItems.Preferences.ToggleViewportBasedFontSizing />
        </MainMenu>
      </Excalidraw>,
    );

    expect(h.state.viewportBasedFontSizingEnabled).toBe(false);

    toggleMenu(container);
    fireEvent.click(
      queryByTestId(container, "toggle-viewport-based-font-sizing")!,
    );

    expect(h.state.viewportBasedFontSizingEnabled).toBe(true);
    expect(
      clearAppStateForLocalStorage(h.state).viewportBasedFontSizingEnabled,
    ).toBe(true);
  });
});
