import React from "react";

import { COLOR_PALETTE, getStrokeWidthByKey } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionChangeFillStyle,
  actionChangeOpacity,
  actionChangeSloppiness,
  actionChangeStrokeStyle,
  actionChangeStrokeWidth,
} from "../actions/actionProperties";
import { clearAppStateForLocalStorage } from "../appState";
import { restoreAppState } from "../data/restore";

import { UI } from "./helpers/ui";
import { API } from "./helpers/api";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

import type { SavedPenPreset } from "../types";

const { h } = window;

describe("adding color top picks", () => {
  beforeEach(async () => {
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    UI.clickTool("rectangle");
  });

  it("pins a palette color from each plus button", async () => {
    fireEvent.click(screen.getAllByTitle("Add saved pen")[0]);
    UI.clickOnTestId("color-violet");

    await waitFor(() => {
      expect(h.state.colorTopPicks.elementStroke).toContainEqual(
        expect.objectContaining({ color: COLOR_PALETTE.violet[4] }),
      );
      expect(h.state.currentItemStrokeColor).toBe(COLOR_PALETTE.violet[4]);
      expect(
        screen.getByTestId(`color-top-pick-${COLOR_PALETTE.violet[4]}`),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getAllByTitle("Add saved pen")[1]);
    UI.clickOnTestId("color-pink");

    await waitFor(() => {
      expect(h.state.colorTopPicks.elementBackground).toContainEqual(
        expect.objectContaining({ color: COLOR_PALETTE.pink[1] }),
      );
      expect(h.state.currentItemBackgroundColor).toBe(COLOR_PALETTE.pink[1]);
      expect(
        screen.getByTestId(`color-top-pick-${COLOR_PALETTE.pink[1]}`),
      ).toBeTruthy();
    });
  });

  it("keeps distinct pen settings for the same color and restores them", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    fireEvent.click(screen.getAllByTitle("Add saved pen")[0]);
    UI.clickOnTestId("color-violet");

    act(() => {
      h.app.actionManager.executeAction(actionChangeStrokeWidth, "ui", "bold");
    });
    act(() => {
      h.app.actionManager.executeAction(
        actionChangeStrokeStyle,
        "ui",
        "dotted",
      );
    });
    act(() => {
      h.app.actionManager.executeAction(actionChangeSloppiness, "ui", 2);
    });
    act(() => {
      h.app.actionManager.executeAction(actionChangeOpacity, "ui", 50);
    });
    act(() => {
      h.app.actionManager.executeAction(actionChangeFillStyle, "ui", "solid");
    });
    fireEvent.click(screen.getAllByTitle("Add saved pen")[0]);
    UI.clickOnTestId("color-violet");

    const picks = h.state.colorTopPicks.elementStroke!;
    const presets = picks.filter(
      (pick): pick is SavedPenPreset =>
        typeof pick !== "string" && pick.color === COLOR_PALETTE.violet[4],
    );
    expect(presets.map((preset) => preset.strokeWidthKey)).toEqual([
      "medium",
      "bold",
    ]);
    expect(presets[1]).toMatchObject({
      strokeStyle: "dotted",
      roughness: 2,
      opacity: 50,
      fillStyle: "solid",
    });

    const stored = clearAppStateForLocalStorage(h.state);
    const restored = restoreAppState(JSON.parse(JSON.stringify(stored)), null);
    expect(restored.colorTopPicks.elementStroke).toEqual(picks);

    fireEvent.click(
      screen.getAllByTestId(`color-top-pick-${COLOR_PALETTE.violet[4]}`)[0],
    );
    await waitFor(() => {
      expect(h.state.currentItemStrokeWidthKey).toBe("medium");
      expect(h.state.currentItemStrokeStyle).toBe("solid");
      expect(h.state.currentItemOpacity).toBe(100);
      expect(h.app.scene.getNonDeletedElement(rectangle.id)?.strokeWidth).toBe(
        getStrokeWidthByKey("rectangle", "medium"),
      );
    });

    fireEvent.click(
      screen.getAllByTestId(`color-top-pick-${COLOR_PALETTE.violet[4]}`)[1],
    );
    expect(h.state.currentItemStrokeWidthKey).toBe("bold");
    expect(h.state.currentItemStrokeStyle).toBe("dotted");
    expect(h.state.currentItemRoughness).toBe(2);
    expect(h.state.currentItemOpacity).toBe(50);
    expect(h.state.currentItemFillStyle).toBe("solid");
    expect(h.app.scene.getNonDeletedElement(rectangle.id)).toMatchObject({
      strokeWidth: getStrokeWidthByKey("rectangle", "bold"),
      strokeStyle: "dotted",
      roughness: 2,
      opacity: 50,
      fillStyle: "solid",
    });
  });

  it("applies a saved background preset including its opacity", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    act(() => {
      h.app.actionManager.executeAction(actionChangeOpacity, "ui", 40);
    });
    fireEvent.click(screen.getAllByTitle("Add saved pen")[1]);
    UI.clickOnTestId("color-pink");

    act(() => {
      h.app.actionManager.executeAction(actionChangeOpacity, "ui", 100);
    });
    fireEvent.click(
      screen.getByTestId(`color-top-pick-${COLOR_PALETTE.pink[1]}`),
    );

    expect(h.state.currentItemOpacity).toBe(40);
    expect(h.app.scene.getNonDeletedElement(rectangle.id)).toMatchObject({
      backgroundColor: COLOR_PALETTE.pink[1],
      opacity: 40,
    });
  });

  it("shows and restores more than ten saved stroke presets", async () => {
    const colors = [
      "cyan",
      "blue",
      "violet",
      "grape",
      "pink",
      "green",
      "teal",
      "yellow",
      "orange",
      "red",
      "gray",
    ];

    for (const color of colors) {
      fireEvent.click(screen.getAllByTitle("Add saved pen")[0]);
      UI.clickOnTestId(`color-${color}`);
    }

    const picks = h.state.colorTopPicks.elementStroke!;
    expect(picks).toHaveLength(16);
    expect(
      h.app.ownerDocument
        .querySelectorAll(".color-picker__top-picks")[0]
        .querySelectorAll("[data-top-pick-index]"),
    ).toHaveLength(17);

    const stored = clearAppStateForLocalStorage(h.state);
    const restored = restoreAppState(JSON.parse(JSON.stringify(stored)), null);
    expect(restored.colorTopPicks.elementStroke).toEqual(picks);
  });
});
