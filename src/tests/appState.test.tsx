import React from "react";
import { render, waitFor } from "./test-utils";
import App from "../components/App";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";

const { h } = window;

describe("appState", () => {
  it("drag&drop file doesn't reset non-persisted appState", async () => {
    const defaultAppState = getDefaultAppState();
    const exportBackground = !defaultAppState.exportBackground;
    render(
      <App
        initialData={{
          appState: {
            ...defaultAppState,
            exportBackground,
          },
          elements: [],
        }}
      />,
    );

    await waitFor(() =>
      expect(h.state.exportBackground).toBe(exportBackground),
    );

    API.dropFile({
      elements: [API.createElement({ type: "rectangle", id: "A" })],
    });

    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      expect(h.state.exportBackground).toBe(exportBackground);
    });
  });
});
