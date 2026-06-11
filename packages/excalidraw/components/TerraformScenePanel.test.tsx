import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { newTextElement } from "@excalidraw/element";

import { TerraformScenePanel } from "./TerraformScenePanel";
import {
  clearTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";

import {
  resetTerraformLayout,
  refreshTerraformLayout,
} from "./terraformSceneApply";

const hoisted = vi.hoisted(() => ({
  setAppState: vi.fn(),
  renderAction: vi.fn((name: string) => (
    <button type="button" data-testid={`action-${name}`}>
      {name}
    </button>
  )),
  replaceAllElements: vi.fn(),
}));

vi.mock("./terraformSceneApply", () => ({
  resetTerraformLayout: vi.fn(() => true),
  refreshTerraformLayout: vi.fn(async () => ({})),
  runTerraformImportFromSources: vi.fn(async () => ({})),
}));

vi.mock("./App", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./App")>();
  return {
    ...mod,
    useExcalidrawElements: () => undefined,
    useExcalidrawSetAppState: () => hoisted.setAppState,
    useExcalidrawContainer: () => ({ container: document.body, id: "test" }),
  };
});

vi.mock("../context/tunnels", () => ({
  useTunnels: () => ({
    WelcomeScreenHelpHintTunnel: { Out: () => null },
  }),
}));

const terraformResource = newTextElement({
  x: 0,
  y: 0,
  text: "r",
  customData: { terraformVisibilityRole: "resource" },
});

const mockApp = {
  scene: {
    getElementsIncludingDeleted: () => [terraformResource],
    replaceAllElements: hoisted.replaceAllElements,
  },
  state: {
    viewBackgroundColor: "#ffffff",
    terraformEdgeLayerPins: null,
    terraformEdgeHoverPeekKey: null,
    terraformLodEnabled: true,
    terraformLodPreset: "balanced",
  },
} as unknown as Parameters<typeof TerraformScenePanel>[0]["app"];

const mockActionManager = {
  renderAction: hoisted.renderAction,
  executeAction: vi.fn(),
} as unknown as Parameters<typeof TerraformScenePanel>[0]["actionManager"];

const openLegend = async () => {
  fireEvent.click(screen.getByTestId("terraform-scene-panel-legend-trigger"));
  await waitFor(() => {
    expect(screen.getByTestId("terraform-color-legend")).toBeTruthy();
  });
};

describe("TerraformScenePanel", () => {
  beforeEach(() => {
    clearTerraformImportSession();
    hoisted.setAppState.mockReset();
    hoisted.replaceAllElements.mockReset();
    vi.mocked(resetTerraformLayout).mockClear();
    vi.mocked(refreshTerraformLayout).mockClear();
  });

  it("is hidden when scene has no terraform resources", () => {
    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[]}
      />,
    );
    expect(screen.queryByTestId("terraform-scene-panel")).toBeNull();
  });

  it("shows action strip and enables reset/refresh when session exists", () => {
    setTerraformImportSession({
      sources: { planDotBundles: [], states: [], tfdTexts: [] },
      semanticLayout: true,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: false,
      },
    });

    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    expect(screen.getByTestId("terraform-scene-panel")).toBeTruthy();
    expect(screen.getByTestId("terraform-debug-reset")).not.toBeDisabled();
    expect(screen.getByTestId("terraform-debug-refresh")).not.toBeDisabled();
    expect(screen.queryByTestId("terraform-debug-toggle-lod")).toBeNull();
    expect(screen.queryByTestId("terraform-lod-preset-balanced")).toBeNull();
    expect(screen.getByTestId("action-undo")).toBeTruthy();
    expect(
      screen.getByTestId("terraform-scene-panel-legend-trigger"),
    ).toBeTruthy();
    expect(screen.getByTestId("terraform-scene-panel-help")).toBeTruthy();
  });

  it("disables reset and refresh without import session", () => {
    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    expect(screen.getByTestId("terraform-debug-reset")).toBeDisabled();
    expect(screen.getByTestId("terraform-debug-refresh")).toBeDisabled();
  });

  it("calls reset and refresh handlers", () => {
    setTerraformImportSession({
      sources: { planDotBundles: [], states: [], tfdTexts: [] },
      semanticLayout: true,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: false,
      },
    });

    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    fireEvent.click(screen.getByTestId("terraform-debug-reset"));
    expect(resetTerraformLayout).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("terraform-debug-refresh"));
    expect(refreshTerraformLayout).toHaveBeenCalled();
  });

  it("opens legend popover with category sections by default", async () => {
    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    await openLegend();

    expect(screen.getByText("Color key")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Hierarchy")).toBeTruthy();
    expect(screen.getByText("Compute")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
  });

  it("switches to plan action legend when toggled", async () => {
    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    await openLegend();
    fireEvent.click(screen.getByTestId("terraform-color-mode-action"));

    expect(screen.getByText("Plan actions")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText("Changed")).toBeTruthy();
    expect(screen.queryByText("Hierarchy")).toBeNull();
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
  });

  it("opens keyboard shortcuts via merged help button", () => {
    render(
      <TerraformScenePanel
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    fireEvent.click(screen.getByTestId("terraform-scene-panel-help"));
    expect(mockActionManager.executeAction).toHaveBeenCalled();
  });
});
