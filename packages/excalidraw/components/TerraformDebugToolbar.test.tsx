import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { newTextElement } from "@excalidraw/element";

import { TerraformDebugToolbar } from "./TerraformDebugToolbar";
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
}));

vi.mock("./terraformSceneApply", () => ({
  resetTerraformLayout: vi.fn(() => true),
  refreshTerraformLayout: vi.fn(async () => ({})),
}));

vi.mock("./App", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./App")>();
  return {
    ...mod,
    useExcalidrawElements: () => undefined,
    useExcalidrawSetAppState: () => hoisted.setAppState,
  };
});

const mockApp = {
  scene: { getElementsIncludingDeleted: () => [] },
  state: { viewBackgroundColor: "#ffffff" },
} as unknown as Parameters<typeof TerraformDebugToolbar>[0]["app"];

const mockActionManager = {
  renderAction: hoisted.renderAction,
} as unknown as Parameters<typeof TerraformDebugToolbar>[0]["actionManager"];

const terraformResource = newTextElement({
  x: 0,
  y: 0,
  text: "r",
  customData: { terraformVisibilityRole: "resource" },
});

describe("TerraformDebugToolbar", () => {
  beforeEach(() => {
    clearTerraformImportSession();
    hoisted.setAppState.mockReset();
    vi.mocked(resetTerraformLayout).mockClear();
    vi.mocked(refreshTerraformLayout).mockClear();
  });

  it("is hidden when scene has no terraform resources", () => {
    render(
      <TerraformDebugToolbar
        app={mockApp}
        actionManager={mockActionManager}
        elements={[]}
      />,
    );
    expect(screen.queryByTestId("terraform-debug-toolbar")).toBeNull();
  });

  it("shows toolbar and enables reset/refresh when session exists", () => {
    setTerraformImportSession({
      sources: { planDotBundles: [], states: [], tfdTexts: [] },
      semanticLayout: true,
      pipelineLayout: false,
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
      <TerraformDebugToolbar
        app={mockApp}
        actionManager={mockActionManager}
        elements={[terraformResource]}
      />,
    );

    expect(screen.getByTestId("terraform-debug-toolbar")).toBeTruthy();
    expect(screen.getByTestId("terraform-debug-reset")).not.toBeDisabled();
    expect(screen.getByTestId("terraform-debug-refresh")).not.toBeDisabled();
    expect(screen.getByTestId("action-undo")).toBeTruthy();
  });

  it("disables reset and refresh without import session", () => {
    render(
      <TerraformDebugToolbar
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
      pipelineLayout: false,
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
      <TerraformDebugToolbar
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
});
