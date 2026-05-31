import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUILTIN_TERRAFORM_IMPORT_PRESETS } from "./terraformImportPresetsTypes";
import {
  createTerraformImportPresetViaApi,
  deleteTerraformImportPresetViaApi,
  fetchTerraformImportPresetsFromApi,
  updateTerraformImportPresetViaApi,
} from "./terraformImportPresetsApi";
import {
  deleteTerraformImportPreset,
  listTerraformImportPresets,
  saveTerraformImportPreset,
  updateTerraformImportPreset,
} from "./terraformImportPresets";

vi.mock("./terraformImportPresetsApi", () => ({
  fetchTerraformImportPresetsFromApi: vi.fn(),
  createTerraformImportPresetViaApi: vi.fn(),
  updateTerraformImportPresetViaApi: vi.fn(),
  deleteTerraformImportPresetViaApi: vi.fn(),
}));

describe("terraformImportPresets", () => {
  beforeEach(() => {
    vi.mocked(fetchTerraformImportPresetsFromApi).mockReset();
    vi.mocked(createTerraformImportPresetViaApi).mockReset();
    vi.mocked(updateTerraformImportPresetViaApi).mockReset();
    vi.mocked(deleteTerraformImportPresetViaApi).mockReset();
  });

  it("lists presets from API", async () => {
    vi.mocked(fetchTerraformImportPresetsFromApi).mockResolvedValue(
      BUILTIN_TERRAFORM_IMPORT_PRESETS,
    );
    const presets = await listTerraformImportPresets();
    expect(presets).toHaveLength(13);
    expect(presets.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        "staging-multi-state",
        "staging-multi-state-expanded",
        "allplanmodules",
        "cloudflare",
        "aws-cloudflare-modules",
        "localstack-geo-fanout",
        "production-geo-fanout",
      ]),
    );
    expect(
      presets.find((preset) => preset.id === "staging-multi-state-expanded")
        ?.view,
    ).toBe("pipeline");
  });

  it("supports user preset save/update/delete lifecycle via API", async () => {
    const custom = {
      id: "custom-one",
      name: "Custom One",
      view: "semantic" as const,
      rootPath: "packages/backend/terraform/staging-multi-state",
      stacks: [
        {
          id: "00-east-network",
          label: "network",
          planPath: "00-east-network/plan.json",
          dotPath: "00-east-network/graph.dot",
          statePath: "00-east-network/terraform.tfstate",
        },
      ],
      tfdPaths: ["pipeline.tfd"],
    };

    vi.mocked(createTerraformImportPresetViaApi).mockResolvedValue(custom);
    vi.mocked(fetchTerraformImportPresetsFromApi)
      .mockResolvedValueOnce(BUILTIN_TERRAFORM_IMPORT_PRESETS)
      .mockResolvedValueOnce([...BUILTIN_TERRAFORM_IMPORT_PRESETS, custom]);

    await saveTerraformImportPreset(custom);
    expect(createTerraformImportPresetViaApi).toHaveBeenCalledWith(custom);

    const updated = {
      ...custom,
      name: "Custom One Updated",
      view: "module" as const,
    };
    vi.mocked(updateTerraformImportPresetViaApi).mockResolvedValue(updated);
    vi.mocked(fetchTerraformImportPresetsFromApi).mockResolvedValueOnce([
      ...BUILTIN_TERRAFORM_IMPORT_PRESETS,
      updated,
    ]);
    await updateTerraformImportPreset("custom-one", updated);
    expect(updateTerraformImportPresetViaApi).toHaveBeenCalledWith(
      "custom-one",
      updated,
    );

    vi.mocked(fetchTerraformImportPresetsFromApi).mockResolvedValueOnce(
      BUILTIN_TERRAFORM_IMPORT_PRESETS,
    );
    await deleteTerraformImportPreset("custom-one");
    expect(deleteTerraformImportPresetViaApi).toHaveBeenCalledWith(
      "custom-one",
    );
  });
});
