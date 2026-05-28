import { describe, expect, it } from "vitest";

import {
  deepCopyElement,
  newFrameElement,
  newElement,
  newTextElement,
} from "@excalidraw/element";
import { Scene } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getInvalidTerraformDraggedElementIds,
  restoreInvalidTerraformDraggedElements,
  syncTerraformDetachedResourceLabelsWithDraggedCards,
} from "./terraformVisibility";

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

describe("Terraform drag constraints", () => {
  const createResourceRect = (
    x: number,
    y: number,
    frameId: string,
    addr: string,
  ) =>
    newElement({
      type: "rectangle",
      x,
      y,
      width: 120,
      height: 48,
      frameId,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: addr,
        nodePath: addr,
      },
    });

  const createPointerDownState = (elements: readonly ExcalidrawElement[]) =>
    ({
      originalElements: new Map(
        elements.map((el) => [el.id, deepCopyElement(el)]),
      ),
    } as PointerDownState);

  it("marks resource invalid when dragged outside its original parent frame", () => {
    const parent = newFrameElement({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      customData: {
        terraform: true,
        terraformVisibilityRole: "group",
      },
    });
    const resource = createResourceRect(
      20,
      20,
      parent.id,
      "aws_s3_bucket.main",
    );

    const scene = new Scene([parent, resource], { skipValidation: true });
    const pointerDownState = createPointerDownState([parent, resource]);

    scene.mutateElement(resource, { x: 360, y: 270 });

    const invalid = getInvalidTerraformDraggedElementIds(
      scene,
      pointerDownState,
      [resource],
    );

    expect(invalid.has(resource.id)).toBe(true);
  });

  it("marks resource invalid when dragged to overlap sibling resource in same parent", () => {
    const parent = newFrameElement({
      x: 0,
      y: 0,
      width: 500,
      height: 320,
      customData: {
        terraform: true,
        terraformVisibilityRole: "group",
      },
    });
    const first = createResourceRect(
      20,
      20,
      parent.id,
      "aws_lambda_function.fn",
    );
    const second = createResourceRect(
      220,
      20,
      parent.id,
      "aws_s3_bucket.bucket",
    );

    const scene = new Scene([parent, first, second], { skipValidation: true });
    const pointerDownState = createPointerDownState([parent, first, second]);

    scene.mutateElement(first, { x: 230, y: 20 });

    const invalid = getInvalidTerraformDraggedElementIds(
      scene,
      pointerDownState,
      [first],
    );

    expect(invalid.has(first.id)).toBe(true);
  });

  it("allows valid drag inside parent without sibling overlap", () => {
    const parent = newFrameElement({
      x: 0,
      y: 0,
      width: 500,
      height: 320,
      customData: {
        terraform: true,
        terraformVisibilityRole: "group",
      },
    });
    const first = createResourceRect(
      20,
      20,
      parent.id,
      "aws_lambda_function.fn",
    );
    const second = createResourceRect(
      220,
      20,
      parent.id,
      "aws_s3_bucket.bucket",
    );

    const scene = new Scene([parent, first, second], { skipValidation: true });
    const pointerDownState = createPointerDownState([parent, first, second]);

    scene.mutateElement(first, { x: 40, y: 120 });

    const invalid = getInvalidTerraformDraggedElementIds(
      scene,
      pointerDownState,
      [first],
    );

    expect(invalid.size).toBe(0);
  });

  it("restores invalid resource and detached label to original coordinates", () => {
    const parent = newFrameElement({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      customData: {
        terraform: true,
        terraformVisibilityRole: "group",
      },
    });
    const addr = "aws_s3_bucket.snapback";
    const resource = createResourceRect(30, 30, parent.id, addr);
    const label = newTextElement({
      x: 40,
      y: 40,
      text: addr,
      containerId: null,
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: addr,
        nodePath: addr,
      },
    });

    const scene = new Scene([parent, resource, label], {
      skipValidation: true,
    });
    const pointerDownState = createPointerDownState([parent, resource, label]);

    scene.mutateElement(resource, { x: 350, y: 260 });
    scene.mutateElement(label, { x: 360, y: 270 });

    const invalid = getInvalidTerraformDraggedElementIds(
      scene,
      pointerDownState,
      [resource],
    );

    restoreInvalidTerraformDraggedElements(scene, pointerDownState, invalid);

    const origResource = pointerDownState.originalElements.get(resource.id)!;
    const origLabel = pointerDownState.originalElements.get(label.id)!;

    expect(resource.x).toBe(origResource.x);
    expect(resource.y).toBe(origResource.y);
    expect(label.x).toBe(origLabel.x);
    expect(label.y).toBe(origLabel.y);
  });
});
