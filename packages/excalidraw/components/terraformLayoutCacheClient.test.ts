import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPresetLayoutCacheUrl,
  fetchPresetLayoutCache,
} from "./terraformLayoutCacheClient";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { runTerraformImportFromSources } from "./terraformSceneApply";

vi.mock("./terraformLayoutWorkerClient", () => ({
  layoutTerraformViaWorkers: vi.fn(),
}));

vi.mock("../data/restore", () => ({
  restoreElements: vi.fn((elements: unknown) => elements),
}));

vi.mock("./terraformVisibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./terraformVisibility")>();
  return {
    ...actual,
    applyTerraformRelationshipFocus: vi.fn((elements: unknown[]) => ({
      elements,
      shouldRepairBindings: false,
    })),
    reconcileTerraformVisibility: vi.fn((elements: unknown[]) => elements),
    repairTerraformEdgeBindings: vi.fn((elements: unknown[]) => elements),
    buildTerraformReconcileOptionsForAppState: vi.fn(() => null),
  };
});

describe("terraformLayoutCacheClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("buildPresetLayoutCacheUrl returns null without version env", () => {
    vi.stubEnv("VITE_TERRAFORM_LAYOUT_CACHE_VERSION", "");
    expect(
      buildPresetLayoutCacheUrl("staging-multi-state-expanded", "semantic"),
    ).toBeNull();
  });

  it("buildPresetLayoutCacheUrl includes module pack", () => {
    vi.stubEnv("VITE_TERRAFORM_LAYOUT_CACHE_VERSION", "abc123def4567890");
    expect(
      buildPresetLayoutCacheUrl("staging-multi-state-expanded", "module", {
        mode: "box",
      } as never),
    ).toContain("pack=box");
    expect(
      buildPresetLayoutCacheUrl("staging-multi-state-expanded", "semantic"),
    ).toContain("v=abc123def456");
  });
});

describe("runTerraformImportFromSources layout cache", () => {
  const mockApp = {
    addFiles: vi.fn(),
    scene: { replaceAllElements: vi.fn() },
    scrollToContent: vi.fn(),
    state: { viewBackgroundColor: "#fff" },
  };

  const setAppState = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VITE_TERRAFORM_LAYOUT_CACHE_VERSION", "abc123def456");
    vi.mocked(layoutTerraformViaWorkers).mockReset();
  });

  it("uses KV cache for preset import without calling layout", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          scene: {
            elements: [{ id: "cached", type: "rectangle" }],
            meta: { importWarnings: [] },
          },
        }),
        { status: 200 },
      ),
    );

    await runTerraformImportFromSources(
      mockApp as never,
      setAppState as never,
      {
        planDotBundles: [],
        states: [],
        stateLabels: [],
        tfdTexts: [],
        tfdLabels: [],
      },
      {
        semanticLayout: true,
        layoutMode: "semantic",
        preset: {
          id: "staging-multi-state-expanded",
          name: "Test",
          builtin: true,
          view: "semantic",
          rootPath: "x",
          stacks: [],
          tfdPaths: [],
          hasContent: true,
        },
        updateSession: false,
        scrollToContent: false,
      },
    );

    expect(fetchSpy).toHaveBeenCalled();
    expect(layoutTerraformViaWorkers).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("falls back to layout on cache miss", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404 }),
    );
    vi.mocked(layoutTerraformViaWorkers).mockResolvedValue({
      elements: [{ id: "laid-out", type: "rectangle" }],
      meta: {},
    });

    await runTerraformImportFromSources(
      mockApp as never,
      setAppState as never,
      {
        planDotBundles: [
          {
            plan: { resource_changes: [] },
            dotText: "digraph {}",
            label: "a",
          },
        ],
        states: [],
        stateLabels: [],
        tfdTexts: [],
        tfdLabels: [],
      },
      {
        semanticLayout: true,
        layoutMode: "semantic",
        preset: {
          id: "demo",
          name: "D",
          builtin: true,
          view: "semantic",
          rootPath: "x",
          stacks: [],
          tfdPaths: [],
          hasContent: true,
        },
        updateSession: false,
        scrollToContent: false,
      },
    );

    expect(layoutTerraformViaWorkers).toHaveBeenCalled();
  });

  it("fetchPresetLayoutCache returns null when version unset", async () => {
    vi.stubEnv("VITE_TERRAFORM_LAYOUT_CACHE_VERSION", "");
    await expect(
      fetchPresetLayoutCache("staging-multi-state-expanded", "semantic"),
    ).resolves.toBeNull();
  });
});
