import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  HAS_STAGING_CLOUDFLARE_MULTI_IMPORT_FIXTURES,
  loadStagingCloudflareMultiImportFixture,
  STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
} from "../test-fixtures/terraformPresetFixtures";

import { restoreElements } from "../data/restore";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";
import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

describe.skipIf(!HAS_STAGING_CLOUDFLARE_MULTI_IMPORT_FIXTURES)(
  "terraform multi-import integration",
  () => {
    beforeAll(() => {
      if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
        vi.spyOn(console, "log").mockImplementation(() => {});
      }
    });

    it(
      "merges staging stacks + cloudflare plan+dot (module view)",
      async () => {
        const { planDotBundles } = loadStagingCloudflareMultiImportFixture({
          stacks: "smoke",
        });

        const res = await terraformPlanParsingFromSources(
          {
            planDotBundles,
            states: [],
            tfdTexts: [],
          },
          { semanticLayout: false },
        );

        expect(res.ok).toBe(true);
        const body = await res.json();
        expect(body.elements.length).toBeGreaterThan(0);
        expect(body.meta?.importBundleCount).toBe(planDotBundles.length);
        expect(body.meta?.importTfdCount).toBe(0);

        const nodePaths = body.elements
          .map(
            (e: { customData?: { nodePath?: string } }) =>
              e.customData?.nodePath,
          )
          .filter(Boolean);
        expect(nodePaths.some((p: string) => p.includes("cloudflare"))).toBe(
          true,
        );
      },
      STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
    );

    it(
      "merges staging stacks + cloudflare (semantic view)",
      async () => {
        const { planDotBundles } = loadStagingCloudflareMultiImportFixture({
          stacks: "smoke",
        });

        const res = await terraformPlanParsingFromSources(
          {
            planDotBundles,
            states: [],
            tfdTexts: [],
          },
          { semanticLayout: true },
        );

        expect(res.ok).toBe(true);
        const body = await res.json();
        expect(body.meta?.layoutEngine).toBe("topology");
        expect(body.elements.length).toBeGreaterThan(0);
        expect(body.meta?.providerBlockCount).toBeGreaterThanOrEqual(2);

        expect(
          body.elements.some(
            (e: {
              customData?: {
                terraformProviderFamily?: string;
                terraformTopologyRole?: string;
              };
            }) =>
              e.customData?.terraformProviderFamily === "cloudflare" &&
              e.customData?.terraformTopologyRole === "provider",
          ),
        ).toBe(true);
        expect(body.meta?.importBundleCount).toBeGreaterThanOrEqual(
          planDotBundles.length,
        );
      },
      STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
    );

    it(
      "layer reconcile stabilizes after import pins (no infinite replace loop)",
      async () => {
        const { planDotBundles } = loadStagingCloudflareMultiImportFixture({
          stacks: "smoke",
        });

        const res = await terraformPlanParsingFromSources(
          {
            planDotBundles,
            states: [],
            tfdTexts: [],
          },
          { semanticLayout: false },
        );
        expect(res.ok).toBe(true);
        const body = await res.json();
        let elements: ExcalidrawElement[] = restoreElements(
          body.elements,
          null,
          {
            repairBindings: true,
          },
        );
        const pins = {
          dependency: false,
          dataFlow: false,
          declaredDataFlow: true,
          networking: false,
        };

        const runPass = (els: typeof elements) => {
          const focus = applyTerraformRelationshipFocus(els, null, "#ffffff");
          const pinReconcile = buildTerraformReconcileOptionsForAppState(
            pins,
            null,
          );
          let next = focus.elements;
          if (pinReconcile) {
            next = reconcileTerraformVisibility(
              focus.shouldRepairBindings
                ? repairTerraformEdgeBindings(next)
                : next,
              pinReconcile,
            );
          } else if (focus.shouldRepairBindings) {
            next = repairTerraformEdgeBindings(next);
          }
          return { next, didChange: focus.didChange };
        };

        let lastSig = "";
        for (let i = 0; i < 8; i++) {
          const { next, didChange } = runPass(elements);
          const sig = next
            .map((e) => `${e.id}:${e.version}:${e.isDeleted ? 1 : 0}`)
            .join("|");
          if (sig === lastSig && !didChange) {
            expect(i).toBeLessThan(4);
            return;
          }
          const priorElements = elements;
          if (
            !didChange &&
            next.length === priorElements.length &&
            next.every((element, index) => element === priorElements[index])
          ) {
            expect(i).toBeLessThan(4);
            return;
          }
          lastSig = sig;
          elements = next;
        }
        throw new Error(
          "visibility reconcile did not stabilize within 8 passes",
        );
      },
      STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
    );
  },
);
