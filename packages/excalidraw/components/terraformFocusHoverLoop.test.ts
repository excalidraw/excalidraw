import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";
import {
  buildTerraformReconcileOptionsForAppState,
  getTerraformEdgeHoverPeekKeyFromHoveredIds,
  getTerraformEdgeLayer,
  isTerraformResourceHoverTarget,
  shouldPreserveTerraformResourceHover,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_ROOT = path.resolve(__dirname, "../../backend/terraform");

describe("terraform resource hover targets", () => {
  it("treats AWS icon glyphs with nodePath as hover targets", () => {
    const icon = {
      id: "icon-1",
      type: "rectangle",
      isDeleted: false,
      customData: {
        terraform: true,
        terraformAwsIconGlyph: true,
        nodePath: "aws_s3_bucket.example",
      },
    } as any;
    expect(isTerraformResourceHoverTarget(icon)).toBe(true);
    expect(
      getTerraformEdgeHoverPeekKeyFromHoveredIds([icon], { "icon-1": true }),
    ).toBe("aws_s3_bucket.example");
  });

  it("treats layout duplicate info glyphs with nodePath as hover targets", () => {
    const glyph = {
      id: "dup-glyph-1",
      type: "image",
      isDeleted: false,
      customData: {
        terraform: true,
        terraformLayoutDuplicateGlyph: true,
        nodePath: "aws_security_group.example",
      },
    } as any;
    expect(isTerraformResourceHoverTarget(glyph)).toBe(true);
  });

  it("preserves hover over terraform frames while moving within a provider box", () => {
    const frame = {
      id: "frame-1",
      type: "frame",
      isDeleted: false,
      customData: { terraform: true, terraformAccountGroup: true },
    } as any;
    expect(shouldPreserveTerraformResourceHover(frame)).toBe(true);
    expect(isTerraformResourceHoverTarget(frame)).toBe(false);
  });
});

const terraformEdgesVisibilitySig = (els: readonly ExcalidrawElement[]) =>
  els
    .filter((e) => getTerraformEdgeLayer(e))
    .map((e) => `${e.id}:${e.isDeleted ? 1 : 0}`)
    .sort()
    .join(";");

const elementRefSig = (els: readonly ExcalidrawElement[]) =>
  els.map((e) => `${e.id}:${e.version}`).join("|");

/** Mirrors LayerUI terraform focus useEffect (pre-fix). */
const runLayerUiTerraformPass = (
  elements: readonly ExcalidrawElement[],
  hoveredElementIds: Readonly<{ [id: string]: true }>,
  pins: typeof TERRAFORM_IMPORT_EDGE_LAYER_PINS,
  viewBackgroundColor: string,
) => {
  const allElements = elements;
  const hoveredPeek = getTerraformEdgeHoverPeekKeyFromHoveredIds(
    allElements,
    hoveredElementIds,
  );
  const activeFocusNodePath = hoveredPeek;
  const result = applyTerraformRelationshipFocus(
    allElements,
    activeFocusNodePath,
    viewBackgroundColor,
  );
  const pinReconcile = buildTerraformReconcileOptionsForAppState(
    pins,
    activeFocusNodePath,
  );
  let next = result.elements;
  if (pinReconcile) {
    next = reconcileTerraformVisibility(
      result.shouldRepairBindings ? repairTerraformEdgeBindings(next) : next,
      pinReconcile,
    );
  } else if (result.shouldRepairBindings) {
    next = repairTerraformEdgeBindings(next);
  }

  const refStable =
    next.length === allElements.length &&
    next.every((element, index) => element === allElements[index]);

  if (
    !result.didChange &&
    refStable
  ) {
    return { next, replaced: false, didChange: result.didChange };
  }

  if (
    !result.didChange &&
    terraformEdgesVisibilitySig(next) === terraformEdgesVisibilitySig(allElements)
  ) {
    return { next, replaced: false, didChange: result.didChange };
  }

  return { next, replaced: true, didChange: result.didChange };
};

describe("terraform focus hover loop (LayerUI effect simulation)", () => {
  it("stabilizes when hovering one semantic resource with default pins", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [{ plan, dotText: dot }],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: true },
    );
    const body = await res.json();
    let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
      repairBindings: true,
    });
    const pins = { ...TERRAFORM_IMPORT_EDGE_LAYER_PINS };
    const resource = elements.find(
      (e) =>
        e.customData?.terraformVisibilityRole === "resource" &&
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string",
    );
    expect(resource).toBeTruthy();
    const hoveredElementIds = { [resource!.id]: true as const };

    for (let i = 0; i < 12; i++) {
      const { next, replaced } = runLayerUiTerraformPass(
        elements,
        hoveredElementIds,
        pins,
        "#ffffff",
      );
      if (!replaced) {
        expect(i).toBeLessThan(6);
        return;
      }
      elements = next;
    }
    throw new Error("did not stabilize while hovering one resource");
  });

  it("is idempotent on consecutive passes with the same hover target", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [{ plan, dotText: dot }],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: true },
    );
    const body = await res.json();
    let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
      repairBindings: true,
    });
    const pins = { ...TERRAFORM_IMPORT_EDGE_LAYER_PINS };
    const resource = elements.find(
      (e) =>
        e.customData?.terraformVisibilityRole === "resource" &&
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string",
    )!;
    const hoveredElementIds = { [resource.id]: true as const };

    // settle
    for (let i = 0; i < 8; i++) {
      const pass = runLayerUiTerraformPass(
        elements,
        hoveredElementIds,
        pins,
        "#ffffff",
      );
      if (!pass.replaced) {
        break;
      }
      elements = pass.next;
    }

    const pass1 = runLayerUiTerraformPass(
      elements,
      hoveredElementIds,
      pins,
      "#ffffff",
    );
    const pass2 = runLayerUiTerraformPass(
      pass1.next,
      hoveredElementIds,
      pins,
      "#ffffff",
    );
    expect(pass2.replaced).toBe(false);
    expect(pass2.didChange).toBe(false);
  });

  it("each hover switch updates scene but same target is idempotent", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [{ plan, dotText: dot }],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: true },
    );
    const body = await res.json();
    let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
      repairBindings: true,
    });
    const pins = { ...TERRAFORM_IMPORT_EDGE_LAYER_PINS };
    const resources = elements.filter(
      (e) =>
        e.customData?.terraformVisibilityRole === "resource" &&
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string",
    );
    expect(resources.length).toBeGreaterThan(1);
    const a = resources[0];
    const b = resources[1];

    const settle = (
      els: ExcalidrawElement[],
      hoveredElementIds: Readonly<{ [id: string]: true }>,
    ) => {
      let current = els;
      for (let i = 0; i < 8; i++) {
        const pass = runLayerUiTerraformPass(
          current,
          hoveredElementIds,
          pins,
          "#ffffff",
        );
        if (!pass.replaced) {
          return pass.next;
        }
        current = pass.next;
      }
      return current;
    };

    const onA = settle(elements, { [a.id]: true as const });
    const onAAgain = runLayerUiTerraformPass(
      onA,
      { [a.id]: true as const },
      pins,
      "#ffffff",
    );
    expect(onAAgain.replaced).toBe(false);

    const onB = settle(onA, { [b.id]: true as const });
    const onBAgain = runLayerUiTerraformPass(
      onB,
      { [b.id]: true as const },
      pins,
      "#ffffff",
    );
    expect(onBAgain.replaced).toBe(false);
  });

  it("does not loop when focus toggles null between hovers (gap flicker)", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [{ plan, dotText: dot }],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: true },
    );
    const body = await res.json();
    let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
      repairBindings: true,
    });
    const pins = { ...TERRAFORM_IMPORT_EDGE_LAYER_PINS };
    const resource = elements.find(
      (e) =>
        e.customData?.terraformVisibilityRole === "resource" &&
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string",
    )!;
    const hovered = { [resource.id]: true as const };
    const sequence: Array<Readonly<{ [id: string]: true }>> = [
      hovered,
      {},
      hovered,
      {},
      hovered,
    ];
    let replaceTotal = 0;
    for (const hoveredElementIds of sequence) {
      for (let i = 0; i < 6; i++) {
        const pass = runLayerUiTerraformPass(
          elements,
          hoveredElementIds,
          pins,
          "#ffffff",
        );
        if (!pass.replaced) {
          break;
        }
        replaceTotal += 1;
        elements = pass.next;
      }
    }
    expect(replaceTotal).toBeLessThan(20);
  });

  it("does not replace across 50 consecutive passes after settle (appState churn)", async () => {
    const plan = JSON.parse(
      fs.readFileSync(path.join(TF_ROOT, "allplanmodules.json"), "utf8"),
    );
    const dot = fs.readFileSync(
      path.join(TF_ROOT, "allplanmodules.dot"),
      "utf8",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [{ plan, dotText: dot }],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: true },
    );
    const body = await res.json();
    let elements: ExcalidrawElement[] = restoreElements(body.elements, null, {
      repairBindings: true,
    });
    const pins = { ...TERRAFORM_IMPORT_EDGE_LAYER_PINS };
    const resource = elements.find(
      (e) =>
        e.customData?.terraformVisibilityRole === "resource" &&
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string",
    )!;
    const hoveredElementIds = { [resource.id]: true as const };
    for (let i = 0; i < 8; i++) {
      const pass = runLayerUiTerraformPass(
        elements,
        hoveredElementIds,
        pins,
        "#ffffff",
      );
      if (!pass.replaced) {
        break;
      }
      elements = pass.next;
    }
    for (let i = 0; i < 50; i++) {
      const pass = runLayerUiTerraformPass(
        elements,
        hoveredElementIds,
        pins,
        "#ffffff",
      );
      expect(pass.replaced).toBe(false);
    }
  });
});
