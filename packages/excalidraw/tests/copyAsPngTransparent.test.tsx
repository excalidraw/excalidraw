import React from "react";

import {
  actionCopyAsPng,
  actionCopyAsPngTransparent,
} from "../actions/actionClipboard";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render, waitFor } from "./test-utils";

const exportCanvas = vi.hoisted(() => vi.fn());

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
  return {
    __esmodule: true,
    ...module,
    exportCanvas,
  };
});

const { h } = window;

/** The appState the action handed to `exportCanvas` (3rd arg). */
const exportedAppState = () => exportCanvas.mock.calls[0][2];
/** The options object the action handed to `exportCanvas` (5th arg). */
const exportedOptions = () => exportCanvas.mock.calls[0][4];

describe("copy as PNG (transparent)", () => {
  beforeEach(async () => {
    exportCanvas.mockClear();
    exportCanvas.mockResolvedValue(undefined);
    await render(<Excalidraw />);

    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
  });

  it("pins a transparent background and 2x scale, ignoring export preferences", async () => {
    act(() => {
      h.setState({ exportBackground: true, exportScale: 1 });
    });

    API.executeAction(actionCopyAsPngTransparent);

    await waitFor(() => expect(exportCanvas).toHaveBeenCalledTimes(1));

    expect(exportCanvas.mock.calls[0][0]).toBe("clipboard");
    expect(exportedAppState().exportBackground).toBe(false);
    expect(exportedAppState().exportScale).toBe(2);
    // the options object drives the actual render, so it must carry the
    // overrides too — not just the appState argument
    expect(exportedOptions().exportBackground).toBe(false);
  });

  it("stays transparent and 2x even when the user exports at 3x with a background", async () => {
    act(() => {
      h.setState({ exportBackground: true, exportScale: 3 });
    });

    API.executeAction(actionCopyAsPngTransparent);

    await waitFor(() => expect(exportCanvas).toHaveBeenCalledTimes(1));

    expect(exportedAppState().exportScale).toBe(2);
    expect(exportedAppState().exportBackground).toBe(false);
  });

  it("does not change the existing copyAsPng action, which follows preferences", async () => {
    act(() => {
      h.setState({ exportBackground: true, exportScale: 3 });
    });

    API.executeAction(actionCopyAsPng);

    await waitFor(() => expect(exportCanvas).toHaveBeenCalledTimes(1));

    expect(exportedAppState().exportBackground).toBe(true);
    expect(exportedAppState().exportScale).toBe(3);
    expect(exportedOptions().exportBackground).toBe(true);
  });
});
