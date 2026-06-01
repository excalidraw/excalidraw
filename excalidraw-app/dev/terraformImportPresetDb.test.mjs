import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getTerraformImportPresetSourcesFromDb,
  openTerraformImportPresetDb,
  resetTerraformImportPresetDbSingleton,
  seedAllBuiltinsFromCatalog,
  TEST_FIXTURE_DB_PATH,
  verifyTerraformImportPresetTestDb,
} from "./terraformImportPresetDb.mjs";

describe("terraformImportPresetDb seed", () => {
  it("committed test DB has all catalog presets with plan+dot content", () => {
    if (!fs.existsSync(TEST_FIXTURE_DB_PATH)) {
      throw new Error(
        `Missing ${TEST_FIXTURE_DB_PATH}. Run yarn export:terraform-presets-test-db.`,
      );
    }
    const { presetCount, withContent } =
      verifyTerraformImportPresetTestDb(TEST_FIXTURE_DB_PATH);
    expect(presetCount).toBe(1);
    expect(withContent).toBe(1);
  });

  it("seeds all catalog presets with plan+dot content when disk files exist", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `terraform-import-presets-test-${Date.now()}.db`,
    );

    resetTerraformImportPresetDbSingleton();
    const db = openTerraformImportPresetDb(dbPath, { seed: false });
    const { presetCount, results } = seedAllBuiltinsFromCatalog(db);
    const missing = results.flatMap((entry) => entry.missing ?? []);

    expect(presetCount).toBe(1);
    if (missing.length > 0) {
      return;
    }

    const presetCountRow = db
      .prepare(`SELECT COUNT(*) AS count FROM terraform_import_presets`)
      .get();
    expect(presetCountRow.count).toBe(1);

    const stack = db
      .prepare(
        `SELECT plan_text AS planText, dot_text AS dotText
         FROM terraform_import_preset_stacks
         WHERE preset_id = 'staging-multi-state-expanded'
         LIMIT 1`,
      )
      .get();
    expect(stack.planText).toMatch(/"resource_changes"/);
    expect(stack.dotText).toMatch(/digraph/i);

    resetTerraformImportPresetDbSingleton();
    for (const suffix of ["", "-wal", "-shm"]) {
      const filePath = `${dbPath}${suffix}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  it("sources use paths-only stackCatalog and resolve TFD use blocks", () => {
    if (!fs.existsSync(TEST_FIXTURE_DB_PATH)) {
      return;
    }
    resetTerraformImportPresetDbSingleton();
    const sources = getTerraformImportPresetSourcesFromDb(
      "staging-multi-state-expanded",
    );
    expect(sources).not.toBeNull();
    expect(sources.planDotBundles).toHaveLength(25);
    expect(sources.stackCatalog).toHaveLength(25);
    expect(sources.stackCatalog[0]).not.toHaveProperty("planText");
    expect(sources.repoName).toBe("staging-multi-state");
    expect(sources.tfdTexts[0]).toMatch(/^tfd 3/);
    expect(sources.tfdTexts[0]).toMatch(/^use 00-east-network/m);
    resetTerraformImportPresetDbSingleton();
  });
});
