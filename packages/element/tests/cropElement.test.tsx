import React from "react";
import { vi } from "vitest";

import { KEYS, cloneJSON } from "@excalidraw/common";

import {
  Excalidraw,
  exportToCanvas,
  exportToSvg,
} from "@excalidraw/excalidraw";
import {
  actionFlipHorizontal,
  actionFlipVertical,
} from "@excalidraw/excalidraw/actions";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  GlobalTestState,
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import { duplicateElement } from "../src/duplicate";

import type {
  ExcalidrawImageElement,
  ImageCrop,
  NonDeleted,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(async () => {
  unmountComponent();

  mouse.reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();

  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
  await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
  API.setAppState({
    zoom: {
      value: 1 as NormalizedZoomValue,
    },
  });

  const image = API.createElement({ type: "image", width: 200, height: 100 });
  API.setElements([image]);
  API.setAppState({
    selectedElementIds: {
      [image.id]: true,
    },
  });
});

const generateRandomNaturalWidthAndHeight = (image: ExcalidrawImageElement) => {
  const initialWidth = image.width;
  const initialHeight = image.height;

  const scale = 1 + Math.random() * 5;

  return {
    naturalWidth: initialWidth * scale,
    naturalHeight: initialHeight * scale,
  };
};

const compareCrops = (cropA: ImageCrop, cropB: ImageCrop) => {
  (Object.keys(cropA) as [keyof ImageCrop]).forEach((key) => {
    const propA = cropA[key];
    const propB = cropB[key];

    expect(propA as number).toBeCloseTo(propB as number);
  });
};

describe("Enter and leave the crop editor", () => {
  it("enter the editor by double clicking", () => {
    const image = h.elements[0];
    expect(h.state.croppingElementId).toBe(null);
    mouse.doubleClickOn(image);
    expect(h.state.croppingElementId).not.toBe(null);
    expect(h.state.croppingElementId).toBe(image.id);
  });

  it("enter the editor by pressing enter", () => {
    const image = h.elements[0];
    expect(h.state.croppingElementId).toBe(null);
    Keyboard.keyDown(KEYS.ENTER);
    expect(h.state.croppingElementId).not.toBe(null);
    expect(h.state.croppingElementId).toBe(image.id);
  });

  it("leave the editor by clicking outside", () => {
    const image = h.elements[0];
    Keyboard.keyDown(KEYS.ENTER);
    expect(h.state.croppingElementId).not.toBe(null);

    mouse.click(image.x - 20, image.y - 20);
    expect(h.state.croppingElementId).toBe(null);
  });

  it("leave the editor by pressing escape", () => {
    const image = h.elements[0];
    mouse.doubleClickOn(image);
    expect(h.state.croppingElementId).not.toBe(null);

    Keyboard.keyDown(KEYS.ESCAPE);
    expect(h.state.croppingElementId).toBe(null);
  });

  it("leave the editor by clicking where the rotation handle would be", () => {
    const image = h.elements[0];
    Keyboard.keyDown(KEYS.ENTER);

    // (the editor draws no rotation handle)
    mouse.clickAt(image.x + image.width / 2, image.y - 16);

    expect(h.state.croppingElementId).toBe(null);
  });

  it("stay in the editor on shift-clicking the image", () => {
    const image = h.elements[0];
    Keyboard.keyDown(KEYS.ENTER);

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.clickAt(image.x + 50, image.y + 50);
    });

    expect(h.state.croppingElementId).toBe(image.id);
    expect(h.state.selectedElementIds).toEqual({ [image.id]: true });
  });

  it("stay in the editor on clicking a crop handle", () => {
    const image = h.elements[0];
    Keyboard.keyDown(KEYS.ENTER);

    // the east handle
    mouse.clickAt(image.x + image.width, image.y + image.height / 2);

    expect(h.state.croppingElementId).toBe(image.id);
  });
});

describe("Crop an image", () => {
  it("Cropping changes the dimension", async () => {
    const image = h.elements[0] as ExcalidrawImageElement;

    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    UI.crop(image, "w", naturalWidth, naturalHeight, [initialWidth / 2, 0]);

    expect(image.width).toBeLessThan(initialWidth);
    UI.crop(image, "n", naturalWidth, naturalHeight, [0, initialHeight / 2]);
    expect(image.height).toBeLessThan(initialHeight);
  });

  it("In the crop editor, dragging a handle crops the image, and dragging the image moves it within its crop (along one axis with shift)", () => {
    const image = API.createElement({
      type: "image",
      width: 200,
      height: 100,
      fileId: "file",
    });
    API.setElements([image]);
    // the file loaded, at twice the element's size
    const htmlImage = new Image();
    Object.defineProperties(htmlImage, {
      naturalWidth: { value: 400 },
      naturalHeight: { value: 200 },
    });
    h.app.imageCache.set(image.fileId!, {
      image: htmlImage,
      mimeType: "image/png",
    });
    API.setSelectedElements([image]);
    Keyboard.keyDown(KEYS.ENTER);
    expect(h.state.croppingElementId).toBe(image.id);

    UI.resize(image, "nw", [50, 25]);

    expect(API.getElement(image)).toMatchObject({ x: 50, y: 25, width: 150 });
    expect(API.getElement(image).crop).toMatchObject({ x: 100, y: 50 });

    // 20px to the right = 40px of the file, at twice the element's size
    mouse.downAt(100, 50);
    mouse.move(20, 0);
    mouse.upAt();

    expect(API.getElement(image)).toMatchObject({ x: 50, y: 25, width: 150 });
    expect(API.getElement(image).crop).toMatchObject({ x: 60, y: 50 });

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.downAt(100, 50);
      mouse.move(10, 4);
      mouse.upAt();
    });

    expect(API.getElement(image).crop).toMatchObject({ x: 40, y: 50 });

    // dragged past the file's edge, it moves back as soon as dragged back
    mouse.downAt(100, 50);
    mouse.move(40, 0);
    expect(API.getElement(image).crop).toMatchObject({ x: 0 });
    mouse.move(-10, 0);
    mouse.upAt();

    expect(API.getElement(image).crop).toMatchObject({ x: 20, y: 50 });
  });

  it("In the crop editor, alt-dragging a handle crops the image from its center", () => {
    const image = API.createElement({
      type: "image",
      width: 200,
      height: 100,
      fileId: "file",
    });
    API.setElements([image]);
    // the file loaded, at twice the element's size
    const htmlImage = new Image();
    Object.defineProperties(htmlImage, {
      naturalWidth: { value: 400 },
      naturalHeight: { value: 200 },
    });
    h.app.imageCache.set(image.fileId!, {
      image: htmlImage,
      mimeType: "image/png",
    });
    API.setSelectedElements([image]);
    Keyboard.keyDown(KEYS.ENTER);

    // as resizing, pressing alt mid-drag crops about the center the drag
    // started with, and releasing it, from the opposite side again
    mouse.downAt(200, 50);
    mouse.moveTo(170, 50);
    expect(API.getElement(image)).toMatchObject({ x: 0, width: 170 });
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyDown(KEYS.ALT);
    });
    expect(API.getElement(image)).toMatchObject({ x: 30, width: 140 });
    Keyboard.keyUp(KEYS.ALT);
    expect(API.getElement(image)).toMatchObject({ x: 0, width: 170 });
    mouse.moveTo(200, 50);
    mouse.upAt();

    UI.resize(image, "e", [-30, 0], { alt: true });

    expect(API.getElement(image)).toMatchObject({ x: 30, width: 140 });
    // 30px off each side = 60px of the file, at twice the element's size
    expect(API.getElement(image).crop).toMatchObject({ x: 60, width: 280 });

    // keeping the aspect ratio too
    UI.resize(image, "e", [-35, 0], { alt: true, shift: true });

    expect(API.getElement(image)).toMatchObject({
      x: 65,
      y: 25,
      width: 70,
      height: 50,
    });
  });

  it("In the crop editor, double-clicking a handle uncrops its side(s), mirrored with alt", () => {
    // the middle of an image twice the element's size, at (0, 0)
    const image = API.createElement({
      type: "image",
      x: 50,
      y: 25,
      width: 100,
      height: 50,
      fileId: "file",
    });
    API.setElements([image]);
    API.updateElement(image, {
      crop: {
        x: 100,
        y: 50,
        width: 200,
        height: 100,
        naturalWidth: 400,
        naturalHeight: 200,
      },
    });
    // bound near the image's south-east corner
    const arrow = UI.createElement("arrow", {
      x: 140,
      y: 300,
      width: 0,
      height: -230,
    });
    API.setSelectedElements([image]);
    Keyboard.keyDown(KEYS.ENTER);

    // the north-east handle
    mouse.doubleClickAt(150, 25);

    expect(API.getElement(image)).toMatchObject({
      x: 50,
      y: 0,
      width: 150,
      height: 75,
    });
    expect(API.getElement(image).crop).toMatchObject({ y: 0, width: 300 });
    // the arrow following the image
    const { x, points } = API.getElement(arrow);
    expect(x + points[1][0]).toBeCloseTo(185);

    Keyboard.undo();

    expect(API.getElement(image)).toMatchObject({ y: 25, width: 100 });

    // the west handle, and so the east one
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.doubleClickAt(50, 50);
    });

    expect(API.getElement(image)).toMatchObject({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
    expect(API.getElement(image).crop).toMatchObject({ x: 0, width: 400 });
  });

  it("Cropping has minimal sizes", async () => {
    const image = h.elements[0] as ExcalidrawImageElement;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    UI.crop(image, "w", naturalWidth, naturalHeight, [initialWidth, 0]);
    expect(image.width).toBeLessThan(initialWidth);
    expect(image.width).toBeGreaterThan(0);
    UI.crop(image, "w", naturalWidth, naturalHeight, [-initialWidth, 0]);
    UI.crop(image, "n", naturalWidth, naturalHeight, [0, initialHeight]);
    expect(image.height).toBeLessThan(initialHeight);
    expect(image.height).toBeGreaterThan(0);
  });

  it("Preserve aspect ratio", async () => {
    let image = h.elements[0] as ExcalidrawImageElement;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    UI.crop(image, "w", naturalWidth, naturalHeight, [initialWidth / 3, 0]);

    let resizedWidth = image.width;
    let resizedHeight = image.height;

    // max height, cropping should not change anything
    UI.crop(
      image,
      "w",
      naturalWidth,
      naturalHeight,
      [-initialWidth / 3, 0],
      true,
    );
    expect(image.width).toBeCloseTo(resizedWidth, 10);
    expect(image.height).toBeCloseTo(resizedHeight, 10);

    // re-crop to initial state
    UI.crop(image, "w", naturalWidth, naturalHeight, [-initialWidth / 3, 0]);
    // change crop height and width
    UI.crop(image, "s", naturalWidth, naturalHeight, [0, -initialHeight / 2]);
    UI.crop(image, "e", naturalWidth, naturalHeight, [-initialWidth / 3, 0]);

    resizedWidth = image.width;
    resizedHeight = image.height;

    // test corner handle aspect ratio preserving
    UI.crop(image, "se", naturalWidth, naturalHeight, [initialWidth, 0], true);
    expect(image.width / image.height).toBe(resizedWidth / resizedHeight);
    expect(image.width).toBeLessThanOrEqual(initialWidth + 0.0001);
    expect(image.height).toBeLessThanOrEqual(initialHeight + 0.0001);

    // reset
    image = API.createElement({ type: "image", width: 200, height: 100 });
    API.setElements([image]);
    API.setAppState({
      selectedElementIds: {
        [image.id]: true,
      },
    });

    // 50 x 50 square
    UI.crop(image, "nw", naturalWidth, naturalHeight, [150, 50]);
    UI.crop(image, "n", naturalWidth, naturalHeight, [0, -100], true);
    expect(image.width).toBeCloseTo(image.height);
    // image is at the corner, not space to its right to expand, should not be able to resize
    expect(image.height).toBeCloseTo(50);

    UI.crop(image, "nw", naturalWidth, naturalHeight, [-150, -100], true);
    expect(image.width).toBeCloseTo(image.height);
    // max height should be reached
    expect(image.height).toBeCloseTo(initialHeight);
    expect(image.width).toBeCloseTo(initialHeight);
  });
});

describe("Cropping and other features", async () => {
  it("Cropping works independently of duplication", async () => {
    const image = h.elements[0] as ExcalidrawImageElement;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    UI.crop(image, "nw", naturalWidth, naturalHeight, [
      initialWidth / 2,
      initialHeight / 2,
    ]);
    Keyboard.keyDown(KEYS.ESCAPE);
    const duplicatedImage = duplicateElement(null, new Map(), image);
    act(() => {
      h.app.scene.insertElement(duplicatedImage);
    });

    expect(duplicatedImage.width).toBe(image.width);
    expect(duplicatedImage.height).toBe(image.height);

    UI.crop(duplicatedImage, "nw", naturalWidth, naturalHeight, [
      -initialWidth / 2,
      -initialHeight / 2,
    ]);
    expect(duplicatedImage.width).toBe(initialWidth);
    expect(duplicatedImage.height).toBe(initialHeight);
    const resizedWidth = image.width;
    const resizedHeight = image.height;

    expect(image.width).not.toBe(duplicatedImage.width);
    expect(image.height).not.toBe(duplicatedImage.height);
    UI.crop(duplicatedImage, "se", naturalWidth, naturalHeight, [
      -initialWidth / 1.5,
      -initialHeight / 1.5,
    ]);
    expect(duplicatedImage.width).not.toBe(initialWidth);
    expect(image.width).toBe(resizedWidth);
    expect(duplicatedImage.height).not.toBe(initialHeight);
    expect(image.height).toBe(resizedHeight);
  });

  it("Resizing should not affect crop", async () => {
    const image = h.elements[0] as ExcalidrawImageElement;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    UI.crop(image, "nw", naturalWidth, naturalHeight, [
      initialWidth / 2,
      initialHeight / 2,
    ]);
    const cropBeforeResizingCloned = cloneJSON(image.crop) as ImageCrop;
    expect(image.crop).not.toBe(null);

    UI.crop(image, "e", naturalWidth, naturalHeight, [200, 0]);
    compareCrops(cropBeforeResizingCloned, image.crop!);
    const cropBeforeResizing = image.crop;

    UI.resize(image, "s", [0, -100]);
    expect(cropBeforeResizing).toBe(image.crop);
    compareCrops(cropBeforeResizingCloned, image.crop!);

    UI.resize(image, "ne", [-50, -50]);
    expect(cropBeforeResizing).toBe(image.crop);
    compareCrops(cropBeforeResizingCloned, image.crop!);
  });

  it("Flipping does not change crop", async () => {
    const image = h.elements[0] as ExcalidrawImageElement;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    mouse.doubleClickOn(image);
    expect(h.state.croppingElementId).not.toBe(null);
    UI.crop(image, "nw", naturalWidth, naturalHeight, [
      initialWidth / 2,
      initialHeight / 2,
    ]);
    Keyboard.keyDown(KEYS.ESCAPE);
    const cropBeforeResizing = image.crop;
    const cropBeforeResizingCloned = cloneJSON(image.crop) as ImageCrop;

    API.executeAction(actionFlipHorizontal);
    expect(image.crop).toBe(cropBeforeResizing);
    compareCrops(cropBeforeResizingCloned, image.crop!);

    API.executeAction(actionFlipVertical);
    expect(image.crop).toBe(cropBeforeResizing);
    compareCrops(cropBeforeResizingCloned, image.crop!);
  });

  it("Exports should preserve crops", async () => {
    const image = h.elements[0] as NonDeleted<ExcalidrawImageElement>;
    const initialWidth = image.width;
    const initialHeight = image.height;

    const { naturalWidth, naturalHeight } =
      generateRandomNaturalWidthAndHeight(image);

    mouse.doubleClickOn(image);
    expect(h.state.croppingElementId).not.toBe(null);
    UI.crop(image, "nw", naturalWidth, naturalHeight, [
      initialWidth / 2,
      initialHeight / 4,
    ]);
    Keyboard.keyDown(KEYS.ESCAPE);
    const widthToHeightRatio = image.width / image.height;

    const canvas = await exportToCanvas({
      elements: [image],
      // @ts-ignore
      appState: h.state,
      files: h.app.files,
      exportPadding: 0,
    });
    const exportedCanvasRatio = canvas.width / canvas.height;

    expect(widthToHeightRatio).toBeCloseTo(exportedCanvasRatio);

    const svg = await exportToSvg({
      elements: [image],
      // @ts-ignore
      appState: h.state,
      files: h.app.files,
      exportPadding: 0,
    });
    const svgWidth = svg.getAttribute("width");
    const svgHeight = svg.getAttribute("height");

    expect(svgWidth).toBeDefined();
    expect(svgHeight).toBeDefined();

    const exportedSvgRatio = Number(svgWidth) / Number(svgHeight);
    expect(widthToHeightRatio).toBeCloseTo(exportedSvgRatio);
  });
});
