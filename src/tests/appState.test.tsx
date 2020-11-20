import React from "react";
import { render, storageMock, waitFor } from "./test-utils";
import AppWithCollab from "../excalidraw-app";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";
import { STORAGE_KEYS } from "../constants";

const { h } = window;

describe("appState", () => {
  it("drag&drop file doesn't reset non-persisted appState", async () => {
    const defaultAppState = getDefaultAppState();
    const exportBackground = !defaultAppState.exportBackground;
    storageMock.getItem({
      [STORAGE_KEYS.LOCAL_STORAGE_APP_STATE]: {
        exportBackground,
        viewBackgroundColor: "#F00",
      },
    });

    await render(<AppWithCollab />);

    await waitFor(() => {
      expect(h.state.exportBackground).toBe(exportBackground);
      expect(h.state.viewBackgroundColor).toBe("#F00");
    });

    API.drop(
      new Blob(
        [
          JSON.stringify({
            type: "excalidraw",
            appState: {
              viewBackgroundColor: "#000",
            },
            elements: [API.createElement({ type: "rectangle", id: "A" })],
          }),
        ],
        { type: "application/json" },
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
});
