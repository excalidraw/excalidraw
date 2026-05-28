import { describe, expect, it } from "vitest";

import {
  getTerraformImportPresetFromD1,
  getTerraformImportPresetSourcesFromD1,
  listTerraformImportPresetsFromD1,
} from "./_terraformPresets";

function createMockD1() {
  const presets = [
    {
      id: "demo",
      name: "Demo",
      description: null,
      builtin: 1,
      view: "semantic" as const,
      root_path: "packages/backend/terraform",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const stacks = [
    {
      preset_id: "demo",
      sort_order: 0,
      stack_id: "main",
      label: "Main",
      plan_path: "plan.json",
      dot_path: "graph.dot",
      state_path: null,
      plan_text: JSON.stringify({ resource_changes: [] }),
      dot_text: "digraph {}",
      state_text: null,
    },
  ];
  const tfd = [
    {
      preset_id: "demo",
      sort_order: 0,
      path: "pipeline.tfd",
      content: "a -> b",
    },
  ];

  const prepare = (sql: string) => {
    const runAll = async () => {
      if (
        sql.includes("FROM terraform_import_presets") &&
        sql.includes("ORDER BY")
      ) {
        return { results: presets };
      }
      if (
        sql.includes("terraform_import_preset_stacks") &&
        sql.includes("COUNT")
      ) {
        return { results: [{ count: 1 }] };
      }
      if (
        sql.includes("terraform_import_preset_stacks") &&
        sql.includes("plan_text")
      ) {
        return { results: stacks };
      }
      if (sql.includes("terraform_import_preset_tfd")) {
        return { results: tfd };
      }
      return { results: [] };
    };

    const runFirst = async () => {
      if (
        sql.includes("WHERE id = ?") &&
        sql.includes("terraform_import_presets")
      ) {
        return presets[0] ?? null;
      }
      if (sql.includes("COUNT(*)")) {
        return { count: 1 };
      }
      return null;
    };

    const statement = {
      all: runAll,
      first: runFirst,
      bind: (..._args: unknown[]) => statement,
    };
    return statement;
  };

  return { prepare } as unknown as D1Database;
}

describe("_terraformPresets", () => {
  it("lists presets with hasContent", async () => {
    const db = createMockD1();
    const presets = await listTerraformImportPresetsFromD1(db);
    expect(presets).toHaveLength(1);
    expect(presets[0]?.id).toBe("demo");
    expect(presets[0]?.hasContent).toBe(true);
  });

  it("returns sources with parsed plan JSON", async () => {
    const db = createMockD1();
    const sources = await getTerraformImportPresetSourcesFromD1(db, "demo");
    expect(sources?.planDotBundles).toHaveLength(1);
    expect(sources?.tfdTexts).toEqual(["a -> b"]);
  });

  it("returns null for missing preset", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;
    const preset = await getTerraformImportPresetFromD1(db, "missing");
    expect(preset).toBeNull();
  });
});
