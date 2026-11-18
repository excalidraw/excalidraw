import React from "react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { render } from "./test-utils";

const mouse = new Pointer("mouse");

describe("eraser", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    // drag-erasing only considers visible elements, and the jsdom viewport
    // is 0x0 by default
    API.setAppState({ width: 1000, height: 1000 });
  });

  const setupOverlapping = () => {
    const bottom = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const top = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
    });
    API.setElements([bottom, top]);
    UI.clickTool("eraser");
    return { bottom, top };
  };

  it("click erases only the top-most element", () => {
    const { bottom, top } = setupOverlapping();

    mouse.clickAt(75, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(false);
  });

  it("drag erases all elements under the path", () => {
    const { bottom, top } = setupOverlapping();

    mouse.downAt(60, 75);
    mouse.moveTo(90, 75);
    mouse.upAt(90, 75);

    expect(API.getElement(top).isDeleted).toBe(true);
    expect(API.getElement(bottom).isDeleted).toBe(true);
  });

  it("click on a bound text label erases the container and its text", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const text = API.createElement({
      type: "text",
      containerId: container.id,
      text: "label",
      x: 25,
      y: 37.5,
      width: 50,
      height: 25,
    });
    API.setElements([
      { ...container, boundElements: [{ id: text.id, type: "text" }] },
      text,
    ]);
    UI.clickTool("eraser");

    mouse.clickAt(50, 50);

    expect(API.getElement(container).isDeleted).toBe(true);
    expect(API.getElement(text).isDeleted).toBe(true);
  });
});
