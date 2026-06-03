/**
 * Run via: PRECOMPUTE_LAYOUT_CACHE=1 LAYOUT_CACHE_VERSION=<sha> yarn vitest run ...
 * Or: yarn precompute:terraform-layout-cache
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import catalog from "../../../packages/backend/terraform/import-presets.catalog.json";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import {
  buildLayoutCacheKey,
  compressLayoutCacheScene,
  MODULE_LAYOUT_PACKS,
  type ModuleLayoutPack,
  type TerraformLayoutCacheView,
} from "../../../functions/_terraformLayoutCache";
import { layoutTerraformFromSources } from "../components/terraformLayoutCore";

import {
  DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  resolveTerraformModuleLayoutOptions,
} from "../components/terraformModuleLayoutOptions";

import type { TerraformPlanParsingSources } from "../components/terraformPlanParsing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../..");
const OUT_DIR = join(REPO_ROOT, "functions/generated");
const OUT_BULK = join(OUT_DIR, "terraform-layout-cache-bulk.json");

const EXPECTED_ELEMENT_COUNTS: Record<string, number> = {
  "staging-multi-state-expanded/semantic": 9160,
  "staging-multi-state-expanded/pipeline": 1121,
};

type CacheEntry = { key: string; value: string };

describe.runIf(process.env.PRECOMPUTE_LAYOUT_CACHE === "1")(
  "precompute terraform layout cache",
  () => {
    it("writes wrangler kv bulk put payload for catalog presets", async () => {
      const version = (process.env.LAYOUT_CACHE_VERSION ?? "")
        .trim()
        .slice(0, 12);
      expect(version.length).toBeGreaterThan(0);

      const bulk: CacheEntry[] = [];
      const manifest: Array<{
        key: string;
        presetId: string;
        view: string;
        pack?: string;
        elementCount: number;
      }> = [];

      const presetIds = catalog.presets
        .filter((p) => p.builtin)
        .map((p) => p.id);

      for (const presetId of presetIds) {
        const sources = getTerraformImportPresetSourcesFromDb(presetId);
        if (!sources) {
          throw new Error(`Preset sources missing in DB: ${presetId}`);
        }

        const views: TerraformLayoutCacheView[] = [
          "semantic",
          "pipeline",
          "module",
        ];

        for (const view of views) {
          const packs: (ModuleLayoutPack | undefined)[] =
            view === "module" ? [...MODULE_LAYOUT_PACKS] : [undefined];

          for (const pack of packs) {
            const moduleLayoutOptions =
              view === "module" && pack
                ? resolveTerraformModuleLayoutOptions({ mode: pack })
                : DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS;

            const layoutMode = view;
            const semanticLayout = view === "semantic";

            const result = await layoutTerraformFromSources(
              sources as TerraformPlanParsingSources,
              {
                semanticLayout,
                layoutMode,
                moduleLayoutOptions:
                  view === "module" ? moduleLayoutOptions : undefined,
              },
            );

            if (!result.ok) {
              throw new Error(
                `Layout failed for ${presetId}/${view}${
                  pack ? `/${pack}` : ""
                }: ${result.error}`,
              );
            }

            const elements = result.scene.elements as unknown[];
            const elementCount = Array.isArray(elements) ? elements.length : 0;

            const countKey = `${presetId}/${view}${pack ? `/${pack}` : ""}`;
            const expected = EXPECTED_ELEMENT_COUNTS[countKey];
            if (expected != null) {
              expect(elementCount).toBe(expected);
            }

            const scene = {
              elements: result.scene.elements,
              files: result.scene.files as Record<string, unknown> | undefined,
              meta: result.scene.meta as Record<string, unknown> | undefined,
            };

            const key = buildLayoutCacheKey(version, presetId, view, pack);
            const value = await compressLayoutCacheScene(scene);
            bulk.push({ key, value });
            manifest.push({
              key,
              presetId,
              view,
              ...(pack ? { pack } : {}),
              elementCount,
            });
          }
        }
      }

      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(OUT_BULK, JSON.stringify(bulk), "utf8");
      writeFileSync(
        join(OUT_DIR, "terraform-layout-cache-manifest.json"),
        JSON.stringify({ version, manifest }, null, 2),
        "utf8",
      );

      expect(bulk.length).toBeGreaterThan(0);
    }, 600_000);
  },
);
