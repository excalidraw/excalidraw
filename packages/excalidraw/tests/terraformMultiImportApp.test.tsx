import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  HAS_AWS_CLOUDFLARE_MULTI_IMPORT_FIXTURES,
  loadAwsCloudflareMultiImportFixture,
} from "../test-fixtures/terraformPresetFixtures";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { terraformPlanParsingFromSources } from "../components/terraformPlanParsing";
import { applyTerraformRelationshipFocus } from "../components/terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "../components/terraformVisibility";

import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

const { h } = window;

describe.skipIf(!HAS_AWS_CLOUDFLARE_MULTI_IMPORT_FIXTURES)(
  "Terraform multi-import App integration",
  () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
        vi.spyOn(console, "log").mockImplementation(() => {});
      }
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("loads merged allplanmodules + cloudflare + tfd in semantic view without update loop", async () => {
      const { awsPlan, awsDot, cfPlan, cfDot, tfd } =
        loadAwsCloudflareMultiImportFixture();

      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles: [
            { plan: awsPlan, dotText: awsDot, label: "aws" },
            { plan: cfPlan, dotText: cfDot, label: "cloudflare" },
          ],
          states: [],
          tfdTexts: [tfd],
        },
        { semanticLayout: true },
      );
      expect(res.ok).toBe(true);
      const body = await res.json();

      let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
        repairBindings: true,
      });
      const pins = {
        dependency: false,
        dataFlow: false,
        declaredDataFlow: true,
        networking: false,
      };
      const focus = applyTerraformRelationshipFocus(elements, null, "#ffffff");
      elements = reconcileTerraformVisibility(
        focus.shouldRepairBindings
          ? repairTerraformEdgeBindings(focus.elements)
          : focus.elements,
        buildTerraformReconcileOptionsForAppState(pins, null)!,
      );

      API.updateScene({ elements });
      API.setAppState({
        terraformEdgeLayerPins: pins,
        terraformEdgeHoverPeekKey: null,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(h.elements.length).toBeGreaterThan(100);
      const nodePaths = h.elements
        .map((e) => e.customData?.nodePath)
        .filter(Boolean);
      expect(nodePaths).toContain("cloudflare::cloudflare_zone.tfdraw_dev");
      expect(
        nodePaths.some(
          (p) => typeof p === "string" && p.includes("workload_writer_lambda"),
        ),
      ).toBe(true);
    }, 180_000);
  },
);
