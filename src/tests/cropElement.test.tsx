import {
  cropElementInternal,
  onElementCroppedInternal,
} from "../element/cropElement";
import { TransformHandleType } from "../element/transformHandles";
import { ExcalidrawElement } from "../element/types";
import { NonDeleted } from "../element/types";
import { ExcalidrawImageElement } from "../element/types";

let element: ExcalidrawImageElement;
let transformHandle: TransformHandleType;
let stateAtCropStart: NonDeleted<ExcalidrawElement>;
let pointerX: number;
let pointerY: number;

describe("crop element", () => {
  beforeEach(() => {
    element = {
      id: "",
      strokeColor: "",
      backgroundColor: "",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roundness: null,
      roughness: 1,
      opacity: 1,
      seed: 0,
      version: 0,
      versionNonce: 0,
      isDeleted: false,
      groupIds: [],
      boundElements: null,
      updated: 0,
      link: null,
      locked: false,
      type: "image",
      fileId: null,
      status: "pending",
      scale: [1, 1],

      x: 0,
      y: 0,
      width: 500,
      height: 500,
      angle: 0,
      rescaleX: 1,
      rescaleY: 1,
      widthAtCreation: 500,
      heightAtCreation: 500,
      underlyingImageWidth: 1000,
      underlyingImageHeight: 1000,
      xToPullFromImage: 0,
      yToPullFromImage: 0,
      wToPullFromImage: 1000,
      hToPullFromImage: 1000,
      westCropAmount: 0,
      eastCropAmount: 0,
      northCropAmount: 0,
      southCropAmount: 0,

      frameId: null,
    };

    stateAtCropStart = { ...element };
    pointerX = 0;
    pointerY = 0;
  });

  it("should return an east-originating crop mutation", () => {
    transformHandle = "e";
    pointerX = 400;

    const result = runTest(
      element,
      transformHandle,
      stateAtCropStart,
      pointerX,
      pointerY,
    );

    expect(result.width).toBe(400);
    expect(result.eastCropAmount).toBe(100);
  });

  it("should return a north-originating crop mutation", () => {
    transformHandle = "n";
    pointerY = 250;

    const result = runTest(
      element,
      transformHandle,
      stateAtCropStart,
      pointerX,
      pointerY,
    );

    expect(result.height).toBe(250);
    expect(result.northCropAmount).toBe(250);
  });

  it("should maintain crop integrity if rotation exists", () => {
    transformHandle = "e";
    pointerX = 400;
    pointerY = 400;

    // 90 degree rotation, the X effectively becomes the Y coordinate.
    // east becomes north
    stateAtCropStart = {
      ...stateAtCropStart,
      angle: (Math.PI / 2) * -1,
    };

    const result = runTest(
      element,
      transformHandle,
      stateAtCropStart,
      pointerX,
      pointerY,
    );

    expect(result.width).toBe(100);
    expect(result.eastCropAmount).toBeCloseTo(400, 2);
  });
});

function runTest(
  element: ExcalidrawImageElement,
  transformHandle: TransformHandleType,
  stateAtCropStart: NonDeleted<ExcalidrawElement>,
  pointerX: number,
  pointerY: number,
) {
  const initialCropResult = cropElementInternal(
    element,
    transformHandle,
    stateAtCropStart,
    pointerX,
    pointerY,
  );

  const newElement = {
    ...element,
    ...initialCropResult,
  };

  const finalCropResult = onElementCroppedInternal(
    newElement,
    transformHandle,
    stateAtCropStart,
  );

  const finalElement = {
    ...newElement,
    ...finalCropResult,
  };

  return finalElement;
}
