import React from "react";

import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";

import { Excalidraw } from "../index";

import {
  actionChangeStrokeColor,
  actionChangeOpacity,
} from "../actions/actionProperties";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render, unmountComponent, act } from "./test-utils";

beforeEach(async () => {
  unmountComponent();
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  API.setAppState({ height: 768, width: MQ_MIN_WIDTH_DESKTOP });
});

describe("per-tool style settings", () => {
  it("should persist styles per tool using actions", async () => {
    // 1. Set Rectangle to Red
    await act(async () => {
      UI.clickTool("rectangle");
    });

    await act(async () => {
      window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        currentItemStrokeColor: "#e03131",
      });
    });
    expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

    // 2. Switch to Pencil (freedraw) and set to Blue
    await act(async () => {
      UI.clickTool("freedraw");
    });

    await act(async () => {
      window.h.app.actionManager.executeAction(actionChangeStrokeColor, "ui", {
        currentItemStrokeColor: "#1971c2",
      });
    });
    expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");

    // 3. Switch back to Rectangle - should be Red again
    await act(async () => {
      UI.clickTool("rectangle");
    });
    expect(window.h.state.currentItemStrokeColor).toBe("#e03131");

    // 4. Switch back to Pencil - should be Blue again
    await act(async () => {
      UI.clickTool("freedraw");
    });
    expect(window.h.state.currentItemStrokeColor).toBe("#1971c2");
  });

  it("should persist opacity per tool using actions", async () => {
    await act(async () => {
      UI.clickTool("rectangle");
    });

    await act(async () => {
      window.h.app.actionManager.executeAction(actionChangeOpacity, "ui", 50);
    });
    expect(window.h.state.currentItemOpacity).toBe(50);

    await act(async () => {
      UI.clickTool("freedraw");
    });

    // Change Pencil to 100
    await act(async () => {
      window.h.app.actionManager.executeAction(actionChangeOpacity, "ui", 100);
    });
    expect(window.h.state.currentItemOpacity).toBe(100);

    await act(async () => {
      UI.clickTool("rectangle");
    });
    expect(window.h.state.currentItemOpacity).toBe(50);

    await act(async () => {
      UI.clickTool("freedraw");
    });
    expect(window.h.state.currentItemOpacity).toBe(100);
  });
});
