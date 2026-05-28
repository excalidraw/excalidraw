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
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

vi.mock("./terraformPlanParsing", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./terraformPlanParsing")>();
  return {
    ...mod,
    terraformPlanParsingFromSources: vi.fn(),
  };
});

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
    vi.mocked(terraformPlanParsingFromSources).mockReset();
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
    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [parsedEl] }), { status: 200 }),
    );
    hoisted.replaceAllElements.mockImplementation((els) => {
      hoisted.getElementsIncludingDeleted.mockReturnValue(els);
    });

    await runTerraformImportFromSources(
      mockApp(),
      hoisted.setAppState,
      { planDotBundles: [], states: [], tfdTexts: [] },
      { semanticLayout: true },
    );

    expect(terraformPlanParsingFromSources).toHaveBeenCalledWith(
      expect.anything(),
      { semanticLayout: true },
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
    expect(terraformPlanParsingFromSources).not.toHaveBeenCalled();
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
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: false,
      },
    });

    vi.mocked(terraformPlanParsingFromSources).mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), { status: 200 }),
    );

    await refreshTerraformLayout(mockApp(), hoisted.setAppState);
    expect(terraformPlanParsingFromSources).toHaveBeenCalled();
  });
});
