import { describe, expect, it, beforeEach } from "vitest";

import { isTextElement, newTextElement } from "@excalidraw/element";

import {
  clearTerraformImportSession,
  cloneTerraformElementsForSnapshot,
  getTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";

describe("terraformImportSession", () => {
  beforeEach(() => {
    clearTerraformImportSession();
  });

  it("stores and retrieves session with cloned snapshot elements", () => {
    const el = newTextElement({ text: "vpc", x: 0, y: 0 });
    const sources = {
      planDotBundles: [],
      states: [],
      tfdTexts: [],
    };

    setTerraformImportSession({
      sources,
      semanticLayout: true,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [el],
        terraformEdgeLayerPins: {
          dependency: false,
          dataFlow: false,
          declaredDataFlow: false,
          networking: false,
        },
        enableDeclaredDataFlow: false,
      },
    });

    const session = getTerraformImportSession();
    expect(session?.semanticLayout).toBe(true);
    expect(session?.snapshot.elements).toHaveLength(1);
    expect(session?.snapshot.elements[0]).not.toBe(el);
    const snap0 = session!.snapshot.elements[0]!;
    expect(isTextElement(snap0) && snap0.text).toBe("vpc");
    expect(snap0).not.toBe(el);
  });

  it("clearTerraformImportSession removes active session", () => {
    setTerraformImportSession({
      sources: { planDotBundles: [], states: [], tfdTexts: [] },
      semanticLayout: false,
      moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
      preset: null,
      importedTfdTexts: [],
      snapshot: {
        elements: [],
        terraformEdgeLayerPins: null,
        enableDeclaredDataFlow: false,
      },
    });
    clearTerraformImportSession();
    expect(getTerraformImportSession()).toBeNull();
  });

  it("cloneTerraformElementsForSnapshot deep-clones", () => {
    const el = newTextElement({ text: "a", x: 1, y: 2 });
    const cloned = cloneTerraformElementsForSnapshot([el]);
    expect(cloned[0]).not.toBe(el);
    expect(isTextElement(cloned[0]) && cloned[0].text).toBe("a");
  });
});
