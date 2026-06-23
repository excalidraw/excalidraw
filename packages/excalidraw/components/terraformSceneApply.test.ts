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
import { fetchPresetLayoutCache } from "./terraformLayoutCacheClient";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";

vi.mock("./terraformLayoutWorkerClient", () => ({
  layoutTerraformViaWorkers: vi.fn(),
}));

vi.mock("./terraformImportPresetLoader", () => ({
  loadTerraformImportPresetSources: vi.fn(),
}));

vi.mock("./terraformLayoutCacheClient", () => ({
  fetchPresetLayoutCache: vi.fn(),
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
    vi.mocked(fetchPresetLayoutCache).mockReset();
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
        moduleLayoutOptions: undefined,
        colorMode: "category",
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
          topologyFrameFlow: false,
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
        moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
        colorMode: "category",
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
        moduleLayoutOptions: rectpackingOptions,
        colorMode: "category",
      },
      expect.anything(),
    );
  });

  it("refreshTerraformLayout preserves semantic layout and tfd overlay from session", async () => {
    setTerraformImportSession({
      sources: {
        planDotBundles: [{ plan: {}, dotText: "digraph {}", label: "s" }],
        states: [],
        tfdTexts: ["a -> b"],
      },
      semanticLayout: true,
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
        semanticLayout: true,
        moduleLayoutOptions: undefined,
        colorMode: "category",
      },
      expect.anything(),
    );
  });

  it("refreshTerraformLayout preserves all RCLL pipeline options from session", async () => {
    setTerraformImportSession({
      sources: {
        planDotBundles: [{ plan: {}, dotText: "digraph {}", label: "s" }],
        states: [],
        tfdTexts: [],
      },
      semanticLayout: false,
      layoutMode: "rcll",
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      pipelineCompact: false,
      pipelinePacked: false,
      pipelinePackedPullLeft: false,
      pipelineIncludeAncillary: true,
      pipelineSemanticPlacement: false,
      pipelineSwimlaneLaneRise: true,
      pipelineReorder: true,
      pipelineCrossingMin: true,
      pipelineDeBandLevel: "none",
      pipelineRankSeparate: true,
      pipelineStraighten: true,
      pipelineDeDensify: false,
      pipelineColumnPacking: "compact",
      pipelineLayoutProfile: "compact",
      pipelineStaircaseBandOverlap: true,
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
      expect.objectContaining({
        layoutMode: "rcll",
        pipelineCompact: false,
        pipelineLayoutVariant: "rcll",
        pipelineIncludeAncillary: true,
        pipelineSwimlaneLaneRise: true,
        pipelineReorder: true,
        pipelineCrossingMin: true,
        pipelineDeBandLevel: "none",
        pipelineRankSeparate: true,
        pipelineStraighten: true,
        pipelineDeDensify: false,
        pipelineColumnPacking: "compact",
        pipelineLayoutProfile: "compact",
        pipelineStaircaseBandOverlap: true,
      }),
      expect.anything(),
    );
  });

  it("relayouts when switching layout mode for identical sources", async () => {
    const semanticEl = newTextElement({
      text: "semantic",
      x: 0,
      y: 0,
      customData: { terraformVisibilityRole: "resource" },
    });
    const pipelineEl = newTextElement({
      text: "pipeline",
      x: 1,
      y: 1,
      customData: { terraformVisibilityRole: "resource" },
    });
    const sources = {
      planDotBundles: [
        { plan: { resource_changes: [] }, dotText: "digraph {}", label: "s" },
      ],
      states: [],
      tfdTexts: ["a -> b"],
      tfdLabels: ["pipeline.tfd"],
    };
    vi.mocked(layoutTerraformViaWorkers)
      .mockResolvedValueOnce({ elements: [semanticEl] })
      .mockResolvedValueOnce({ elements: [pipelineEl] })
      .mockResolvedValueOnce({ elements: [semanticEl] });
    hoisted.replaceAllElements.mockImplementation((els) => {
      hoisted.getElementsIncludingDeleted.mockReturnValue(els);
    });

    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      sources,
      { semanticLayout: true, layoutMode: "semantic" },
    );
    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      sources,
      { semanticLayout: false, layoutMode: "pipeline" },
    );
    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      sources,
      { semanticLayout: true, layoutMode: "semantic" },
    );

    expect(layoutTerraformViaWorkers).toHaveBeenCalledTimes(3);
  });

  it("rcll skips the KV layout cache; module consults it (§31)", async () => {
    // RCLL's dials aren't part of the cache key yet, so an rcll import must
    // never return a stale cached compound layout. Guard: rcll skips the cache,
    // module (a cached view) consults it — the contrast proves the assertion.
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [
        newTextElement({
          text: "x",
          x: 0,
          y: 0,
          customData: { terraformVisibilityRole: "resource" },
        }),
      ],
    });
    vi.mocked(fetchPresetLayoutCache).mockResolvedValue(null); // cache miss → proceed to worker
    hoisted.replaceAllElements.mockImplementation((els) => {
      hoisted.getElementsIncludingDeleted.mockReturnValue(els);
    });

    const preset = { id: "demo-preset" } as unknown as TerraformImportPreset;
    const sources = { planDotBundles: [], states: [], tfdTexts: [] };

    // module → cache IS consulted (vacuity guard).
    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      sources,
      {
        semanticLayout: false,
        layoutMode: "module",
        preset,
      },
    );
    expect(fetchPresetLayoutCache).toHaveBeenCalledTimes(1);

    vi.mocked(fetchPresetLayoutCache).mockClear();

    // rcll → cache is SKIPPED; the worker still runs.
    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      sources,
      {
        semanticLayout: false,
        layoutMode: "rcll",
        preset,
      },
    );
    expect(fetchPresetLayoutCache).not.toHaveBeenCalled();
    expect(layoutTerraformViaWorkers).toHaveBeenCalled();
  });
});
