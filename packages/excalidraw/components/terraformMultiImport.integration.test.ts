import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { loadAwsCloudflareMultiImportFixture } from "../test-fixtures/terraformPresetFixtures";

import { restoreElements } from "../data/restore";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";
import { prefixStackAddress } from "./terraformStackAddress";

import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

describe("terraform multi-import integration", () => {
  beforeAll(() => {
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
  });

  it("merges allplanmodules + cloudflare plan+dot with tfd (module view)", async () => {
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
        tfdLabels: ["allplanmodules.tfd"],
      },
      { semanticLayout: false },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.elements.length).toBeGreaterThan(0);
    expect(body.meta?.importBundleCount).toBe(2);
    expect(body.meta?.importTfdCount).toBe(1);

    const nodePaths = body.elements
      .map(
        (e: { customData?: { nodePath?: string } }) => e.customData?.nodePath,
      )
      .filter(Boolean);
    expect(nodePaths).toContain(
      prefixStackAddress("cloudflare", "cloudflare_zone.tfdraw_dev"),
    );
    expect(
      nodePaths.some((p: string) => p.includes("workload_writer_lambda")),
    ).toBe(true);
  }, 120_000);

  it("merges allplanmodules + cloudflare with tfd (semantic view)", async () => {
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
    expect(body.meta?.layoutEngine).toBe("topology");
    expect(body.elements.length).toBeGreaterThan(0);
    expect(body.meta?.providerBlockCount).toBeGreaterThanOrEqual(2);

    const nodePaths = body.elements
      .map(
        (e: { customData?: { nodePath?: string } }) => e.customData?.nodePath,
      )
      .filter(Boolean);
    expect(nodePaths).toContain(
      prefixStackAddress("cloudflare", "cloudflare_zone.tfdraw_dev"),
    );
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
  }, 180_000);

  it("layer reconcile stabilizes after import pins (no infinite replace loop)", async () => {
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
      { semanticLayout: false },
    );
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

    const runPass = (els: typeof elements) => {
      const focus = applyTerraformRelationshipFocus(els, null, "#ffffff");
      const pinReconcile = buildTerraformReconcileOptionsForAppState(
        pins,
        null,
      );
      let next = focus.elements;
      if (pinReconcile) {
        next = reconcileTerraformVisibility(
          focus.shouldRepairBindings ? repairTerraformEdgeBindings(next) : next,
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
    throw new Error("visibility reconcile did not stabilize within 8 passes");
  }, 180_000);
});
