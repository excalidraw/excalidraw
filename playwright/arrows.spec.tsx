import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";

// package needs to be built first so that packages/excalidraw/dist exists
import { Excalidraw } from "../packages/excalidraw";

import elements_arrowsOne from "./fixtures/arrows-one.json";
import elements_arrowsTwo from "./fixtures/arrows-two.json";

test("elbow arrow visual tests", async ({ mount, page }) => {
  test.setTimeout(15000);

  await page.setViewportSize({ width: 4080, height: 1920 });

  const component = await mount(
    <Excalidraw
      zenModeEnabled
      initialData={{
        elements: elements_arrowsOne,
      }}
    />,
  );

  // await expect(component).toContainClass("excalidraw-container");
  await expect(component).toHaveScreenshot("excalidraw-arrows-one.png");

  // await component.unmount();

  await component.update(
    <Excalidraw
      // so that the component remounts and initialData is set again
      key={Math.random().toString()}
      zenModeEnabled
      initialData={{
        elements: elements_arrowsTwo,
      }}
    />,
  );

  await expect(component).toHaveScreenshot("excalidraw-arrows-two.png");
});
