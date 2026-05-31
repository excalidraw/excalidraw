import { beforeEach, describe, expect, it, vi } from "vitest";

import { newTextElement } from "@excalidraw/element";

import {
  applyTerraformExcalidrawScene,
  refreshTerraformLayout,
  resetTerraformLayout,
  runTerraformImportFromSources,
} from "./terraformSceneApply";
import {
  clearTerraformImportSession,
  getTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";

vi.mock("./terraformLayoutWorkerClient", () => ({
  layoutTerraformViaWorkers: vi.fn(),
}));

vi.mock("./terraformImportPresetLoader", () => ({
  loadTerraformImportPresetSources: vi.fn(),
}));

const hoisted = vi.hoisted(() => ({
  addFiles: vi.fn(),
  replaceAllElements: vi.fn(),
  scrollToContent: vi.fn(),
  setAppState: vi.fn(),
  getElementsIncludingDeleted: vi.fn(() => []),
}));

const mockApp = () =>
  ({
    addFiles: hoisted.addFiles,
    scene: {
      replaceAllElements: hoisted.replaceAllElements,
      getElementsIncludingDeleted: hoisted.getElementsIncludingDeleted,
    },
    scrollToContent: hoisted.scrollToContent,
    state: { viewBackgroundColor: "#ffffff" },
  } as unknown as Parameters<typeof applyTerraformExcalidrawScene>[0]);

describe("terraformSceneApply", () => {
  beforeEach(() => {
    clearTerraformImportSession();
    vi.mocked(layoutTerraformViaWorkers).mockReset();
    hoisted.addFiles.mockReset();
    hoisted.replaceAllElements.mockReset();
    hoisted.scrollToContent.mockReset();
    hoisted.setAppState.mockReset();
    hoisted.getElementsIncludingDeleted.mockReset();
    hoisted.getElementsIncludingDeleted.mockReturnValue([]);
  });

  it("applyTerraformExcalidrawScene replaces elements and sets edge pins", () => {
    const el = newTextElement({ text: "r", x: 0, y: 0 });
    applyTerraformExcalidrawScene(
      mockApp(),
      hoisted.setAppState,
      { elements: [el] },
      { enableDeclaredDataFlow: true },
    );
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
    expect(hoisted.setAppState).toHaveBeenCalledWith(
      expect.objectContaining({
        terraformEdgeLayerPins: expect.objectContaining({
          declaredDataFlow: true,
        }),
      }),
    );
  });

  it("runTerraformImportFromSources parses, applies, and stores session", async () => {
    const parsedEl = newTextElement({
      text: "from-parse",
      x: 0,
      y: 0,
      customData: { terraformVisibilityRole: "resource" },
    });
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [parsedEl],
    });
    hoisted.replaceAllElements.mockImplementation((els) => {
      hoisted.getElementsIncludingDeleted.mockReturnValue(els);
    });

    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      { planDotBundles: [], states: [], tfdTexts: [] },
      { semanticLayout: true },
    );

    expect(layoutTerraformViaWorkers).toHaveBeenCalledWith(
      expect.anything(),
      {
        semanticLayout: true,
        pipelineLayout: false,
        moduleLayoutOptions: undefined,
      },
      expect.anything(),
    );
    const session = getTerraformImportSession();
    expect(session).not.toBeNull();
    expect(session?.semanticLayout).toBe(true);
  });

  it("resetTerraformLayout restores snapshot without re-parsing", () => {
    const snapshotEl = newTextElement({ text: "snapshot", x: 10, y: 20 });
    setTerraformImportSession({
      sources: { planDotBundles: [], states: [], tfdTexts: [] },
      semanticLayout: true,
      pipelineLayout: false,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [snapshotEl],
        terraformEdgeLayerPins: {
          dependency: false,
          dataFlow: false,
          declaredDataFlow: true,
          networking: false,
        },
        enableDeclaredDataFlow: true,
      },
    });

    const ok = resetTerraformLayout(mockApp(), hoisted.setAppState);
    expect(ok).toBe(true);
    expect(layoutTerraformViaWorkers).not.toHaveBeenCalled();
    expect(hoisted.replaceAllElements).toHaveBeenCalled();
  });

  it("refreshTerraformLayout re-parses from session sources", async () => {
    setTerraformImportSession({
      sources: {
        planDotBundles: [{ plan: {}, dotText: "digraph {}", label: "s" }],
        states: [],
        tfdTexts: [],
      },
      semanticLayout: false,
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

    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({ elements: [] });

    await refreshTerraformLayout(mockApp(), hoisted.setAppState);
    expect(layoutTerraformViaWorkers).toHaveBeenCalledWith(
      expect.anything(),
      {
        semanticLayout: false,
        pipelineLayout: false,
        moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      },
      expect.anything(),
    );
  });

  it("refreshTerraformLayout preserves custom module packing options from session", async () => {
    const rectpackingOptions = {
      ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      mode: "rectpacking" as const,
    };
    setTerraformImportSession({
      sources: {
        planDotBundles: [{ plan: {}, dotText: "digraph {}", label: "s" }],
        states: [],
        tfdTexts: [],
      },
      semanticLayout: false,
      pipelineLayout: false,
      moduleLayoutOptions: rectpackingOptions,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: false,
      },
    });

    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({ elements: [] });

    await refreshTerraformLayout(mockApp(), hoisted.setAppState);
    expect(layoutTerraformViaWorkers).toHaveBeenCalledWith(
      expect.anything(),
      {
        semanticLayout: false,
        pipelineLayout: false,
        moduleLayoutOptions: rectpackingOptions,
      },
      expect.anything(),
    );
  });

  it("refreshTerraformLayout preserves pipeline layout mode from session", async () => {
    setTerraformImportSession({
      sources: {
        planDotBundles: [{ plan: {}, dotText: "digraph {}", label: "s" }],
        states: [],
        tfdTexts: ["a -> b"],
      },
      semanticLayout: false,
      pipelineLayout: true,
      pipelineLayoutMode: "global-relayer",
      pipelineVerticalSolverMode: "constrained-ls",
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: ["a -> b"],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: true,
      },
    });

    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({ elements: [] });

    await refreshTerraformLayout(mockApp(), hoisted.setAppState);
    expect(layoutTerraformViaWorkers).toHaveBeenCalledWith(
      expect.anything(),
      {
        semanticLayout: false,
        pipelineLayout: true,
        pipelineLayoutMode: "global-relayer",
        pipelineVerticalSolverMode: "constrained-ls",
        moduleLayoutOptions: undefined,
      },
      expect.anything(),
    );
  });
});
