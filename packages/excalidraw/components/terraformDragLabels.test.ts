import { describe, expect, it } from "vitest";

import {
  deepCopyElement,
  newElement,
  newTextElement,
} from "@excalidraw/element";
import { Scene } from "@excalidraw/element";

import { syncTerraformDetachedResourceLabelsWithDraggedCards } from "./terraformVisibility";

import type { PointerDownState } from "../types";

describe("syncTerraformDetachedResourceLabelsWithDraggedCards", () => {
  it("moves detached Terraform label by the same delta as its resource rectangle", () => {
    const addr = "aws_s3_bucket.example";
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 48,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: addr,
        nodePath: addr,
      },
    });
    const label = newTextElement({
      x: 12,
      y: 8,
      text: addr,
      containerId: null,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: addr,
        nodePath: addr,
      },
    });

    const scene = new Scene([rect, label], { skipValidation: true });

    const originalElements = new Map(
      [rect, label].map((el) => [el.id, deepCopyElement(el)]),
    ) as PointerDownState["originalElements"];

    const pointerDownState = {
      originalElements,
    } as PointerDownState;

    scene.mutateElement(rect, { x: 40, y: 25 });

    syncTerraformDetachedResourceLabelsWithDraggedCards(
      scene,
      pointerDownState,
      [rect],
    );

    const origRect = originalElements.get(rect.id)!;
    const origLabel = originalElements.get(label.id)!;
    const dx = rect.x - origRect.x;
    const dy = rect.y - origRect.y;
    expect(label.x).toBe(origLabel.x + dx);
    expect(label.y).toBe(origLabel.y + dy);
  });
});
