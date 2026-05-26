import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_ROOT = path.resolve(__dirname, "../../backend/terraform");

const { h } = window;

describe("Terraform multi-import App integration", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("loads merged allplanmodules + cloudflare + tfd in semantic view without update loop", async () => {
    const awsPlan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const awsDot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const cfPlan = JSON.parse(
      fs.readFileSync(
        path.join(TF_ROOT, "cloudflare/cloudflare-plan.json"),
        "utf8",
      ),
    );
    const cfDot = fs.readFileSync(
      path.join(TF_ROOT, "cloudflare/cloudflare-plan.dot"),
      "utf8",
    );
    const tfd = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.tfd"),
      "utf8",
    );

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
    expect(nodePaths).toContain("cloudflare_zone.tfdraw_dev");
    expect(
      nodePaths.some(
        (p) => typeof p === "string" && p.includes("workload_writer_lambda"),
      ),
    ).toBe(true);
  }, 180_000);
});
