import { beforeEach, describe, expect, it } from "vitest";

import { newElement } from "@excalidraw/element";

import {
  buildTerraformReconcileOptionsForAppState,
  toggleTerraformExplode,
} from "../components/terraformVisibility";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

const { h } = window;

describe("Terraform App integration", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("toggleTerraformExplode expands a category card in the live editor scene", () => {
    const parentKey = "module.example";
    const childKey = "aws_s3_bucket.data";
    const parent = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: parentKey,
        terraformNodeKind: "category",
        terraformInitiallyVisible: true,
      },
    });
    const child = newElement({
      type: "rectangle",
      x: 0,
      y: 80,
      width: 120,
      height: 40,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: childKey,
        terraformNodeKind: "resource",
        terraformExplodeParent: parentKey,
        terraformInitiallyVisible: false,
      },
    });

    API.updateScene({ elements: [parent, child] });

    const next = toggleTerraformExplode(
      h.elements,
      parent,
      buildTerraformReconcileOptionsForAppState(
        h.state.terraformEdgeLayerPins,
        h.state.terraformEdgeHoverPeekKey,
      ),
    );
    API.updateScene({ elements: next });

    const updatedParent = h.elements.find((e) => e.id === parent.id);
    expect(updatedParent?.customData?.terraformExploded).toBe(true);
  });
});
