import { expect } from "@playwright/test";

import { createExcalidrawTest, createLocalStorageSceneAdapter } from "./kit";

import type { ShapeType } from "./kit";

/**
 * Shape coverage for the generic kit. Each case draws exactly one element and
 * asserts it through the scene adapter, so none of these tests depend on the
 * export dialog or on any particular app feature.
 */
const test = createExcalidrawTest(() =>
  createLocalStorageSceneAdapter({ elementsKey: "excalidraw" }),
);

test.beforeEach(async ({ editor }) => {
  await editor.open();
});

const SHAPES: Array<{ type: ShapeType; title: string }> = [
  { type: "rectangle", title: "draws a rectangle" },
  { type: "diamond", title: "draws a diamond" },
  { type: "ellipse", title: "draws an ellipse" },
  { type: "arrow", title: "draws an arrow" },
  { type: "line", title: "draws a line" },
  { type: "freedraw", title: "draws a freehand stroke" },
  { type: "text", title: "draws text" },
  { type: "frame", title: "draws a frame" },
];

for (const { type, title } of SHAPES) {
  test(title, async ({ editor }) => {
    await editor.drawShape(type);
    await editor.waitForElementType(type, 1);

    const elements = await editor.getElementsByType(type);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe(type);
  });
}

test("draws multiple shapes into the same scene", async ({ editor }) => {
  await editor.drawRectangle();
  await editor.drawEllipse();
  await editor.drawArrow();

  await editor.waitForElementCount(3);

  const types = (await editor.getElements())
    .map((element) => element.type)
    .sort();

  expect(types).toEqual(["arrow", "ellipse", "rectangle"]);
});

test("clears the scene", async ({ editor }) => {
  await editor.drawRectangle();
  await editor.waitForElementCount(1);

  await editor.clear();
});
