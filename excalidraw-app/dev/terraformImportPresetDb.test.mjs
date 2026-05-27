import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getTerraformImportPresetFromDb,
  getTerraformImportPresetDb,
  listTerraformImportPresetsFromDb,
  resetTerraformImportPresetDbSingleton,
  seedAllBuiltinsFromCatalog,
} from "./terraformImportPresetDb.mjs";

describe("terraformImportPresetDb seed", () => {
  it("seeds all catalog presets with plan+dot content", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `terraform-import-presets-test-${Date.now()}.db`,
    );

    resetTerraformImportPresetDbSingleton();
    const db = getTerraformImportPresetDb(dbPath);
    const { presetCount } = seedAllBuiltinsFromCatalog(db);

    expect(presetCount).toBe(10);

    const presets = listTerraformImportPresetsFromDb();
    expect(presets).toHaveLength(10);
    expect(presets.every((preset) => preset.hasContent)).toBe(true);

    const allplanmodules = getTerraformImportPresetFromDb("allplanmodules", {
      includeContent: true,
    });
    expect(allplanmodules?.stacks[0]?.planText).toMatch(/"resource_changes"/);
    expect(allplanmodules?.stacks[0]?.dotText).toMatch(/digraph/i);

    resetTerraformImportPresetDbSingleton();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(`${dbPath}-wal`)) {
      fs.unlinkSync(`${dbPath}-wal`);
    }
    if (fs.existsSync(`${dbPath}-shm`)) {
      fs.unlinkSync(`${dbPath}-shm`);
    }
  });
});
