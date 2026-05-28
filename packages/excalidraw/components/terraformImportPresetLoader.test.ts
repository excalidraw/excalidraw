import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";

import type { TerraformImportPreset } from "./terraformImportPresets";

const okResponse = (body: string) =>
  new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

describe("terraformImportPresetLoader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads from preset DB sources API when content is stored", async () => {
    const preset: TerraformImportPreset = {
      id: "x",
      name: "X",
      view: "semantic",
      rootPath: "packages/backend/terraform/staging-multi-state",
      hasContent: true,
      stacks: [
        {
          id: "00-east-network",
          label: "00-east-network",
          planPath: "00-east-network/plan.json",
          dotPath: "00-east-network/graph.dot",
        },
      ],
      tfdPaths: ["pipeline.tfd"],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const input = String(url);
      if (input.includes("/sources")) {
        return new Response(
          JSON.stringify({
            sources: {
              planDotBundles: [
                {
                  plan: { resource_changes: [] },
                  dotText: "digraph {}",
                  label: "00-east-network",
                },
              ],
              states: [],
              stateLabels: [],
              tfdTexts: ["a -> b"],
              tfdLabels: ["pipeline.tfd"],
              warnings: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const loaded = await loadTerraformImportPresetSources(preset, {
      allowApiFetch: true,
      allowDevFetch: false,
      allowDirectoryHandleFallback: false,
    });

    expect(loaded.planDotBundles).toHaveLength(1);
    expect(loaded.tfdLabels).toEqual(["pipeline.tfd"]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/terraform-import-presets/x/sources",
    );
  });

  it("falls back to dev fetch when DB has no content", async () => {
    const preset: TerraformImportPreset = {
      id: "x",
      name: "X",
      view: "semantic",
      rootPath: "packages/backend/terraform/staging-multi-state",
      hasContent: false,
      stacks: [
        {
          id: "00-east-network",
          label: "00-east-network",
          planPath: "00-east-network/plan.json",
          dotPath: "00-east-network/graph.dot",
          statePath: "00-east-network/terraform.tfstate",
        },
      ],
      tfdPaths: ["pipeline.tfd"],
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const input = String(url);
      if (input.includes("/sources")) {
        return new Response(JSON.stringify({ error: "no content" }), {
          status: 400,
        });
      }
      if (input.includes("plan.json")) {
        return okResponse(JSON.stringify({ resource_changes: [] }));
      }
      if (input.includes("graph.dot")) {
        return okResponse("digraph {}");
      }
      if (input.includes("pipeline.tfd")) {
        return okResponse("a -> b");
      }
      return new Response("missing", { status: 404 });
    });

    const loaded = await loadTerraformImportPresetSources(preset, {
      allowApiFetch: true,
      allowDevFetch: true,
      allowDirectoryHandleFallback: false,
    });

    expect(loaded.planDotBundles).toHaveLength(1);
    expect(
      loaded.warnings.some((warning) => warning.code === "missing_state_file"),
    ).toBe(true);
  });

  it("rejects unsafe relative paths", async () => {
    const preset: TerraformImportPreset = {
      id: "x",
      name: "X",
      view: "semantic",
      hasContent: false,
      rootPath: "packages/backend/terraform/staging-multi-state",
      stacks: [
        {
          id: "unsafe",
          label: "unsafe",
          planPath: "../secret.json",
          dotPath: "unsafe/graph.dot",
        },
      ],
      tfdPaths: [],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "no content" }), { status: 400 }),
    );

    await expect(
      loadTerraformImportPresetSources(preset, {
        allowApiFetch: true,
        allowDevFetch: true,
        allowDirectoryHandleFallback: false,
      }),
    ).rejects.toThrow(/unsafe/i);
  });
});
