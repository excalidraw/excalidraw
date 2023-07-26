import ReactDOM from "react-dom";
import { render } from "./test-utils";
import App from "../components/App";
import * as Renderer from "../renderer/renderScene";
import { reseed } from "../random";
import { UI, Keyboard } from "./helpers/ui";
import { resize } from "./utils";
import { ExcalidrawTextElement } from "../element/types";
import ExcalidrawApp from "../excalidraw-app";
import { API } from "./helpers/api";
import { KEYS } from "../keys";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("resize rectangle ellipses and diamond elements", () => {
  const elemData = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };
  // Value for irrelevant cursor movements
  const _ = 234;

  it.each`
    handle  | move            | dimensions    | topLeft
    ${"n"}  | ${[_, -100]}    | ${[100, 200]} | ${[elemData.x, -100]}
    ${"s"}  | ${[_, 39]}      | ${[100, 139]} | ${[elemData.x, elemData.x]}
    ${"e"}  | ${[-20, _]}     | ${[80, 100]}  | ${[elemData.x, elemData.y]}
    ${"w"}  | ${[-20, _]}     | ${[120, 100]} | ${[-20, elemData.y]}
    ${"ne"} | ${[5, 55]}      | ${[105, 45]}  | ${[elemData.x, 55]}
    ${"se"} | ${[-30, -10]}   | ${[70, 90]}   | ${[elemData.x, elemData.y]}
    ${"nw"} | ${[-300, -200]} | ${[400, 300]} | ${[-300, -200]}
    ${"sw"} | ${[40, -20]}    | ${[60, 80]}   | ${[40, 0]}
  `(
    "resizes with handle $handle",
    async ({ handle, move, dimensions, topLeft }) => {
      await render(<App />);
      const rectangle = UI.createElement("rectangle", elemData);
      resize(rectangle, handle, move);
      const element = h.elements[0];
      expect([element.width, element.height]).toEqual(dimensions);
      expect([element.x, element.y]).toEqual(topLeft);
    },
  );

  it.each`
    handle  | move            | dimensions    | topLeft
    ${"n"}  | ${[_, -100]}    | ${[200, 200]} | ${[-50, -100]}
    ${"nw"} | ${[-300, -200]} | ${[400, 400]} | ${[-300, -300]}
    ${"sw"} | ${[40, -20]}    | ${[80, 80]}   | ${[20, 0]}
  `(
    "resizes with fixed side ratios on handle $handle",
    async ({ handle, move, dimensions, topLeft }) => {
      await render(<App />);
      const rectangle = UI.createElement("rectangle", elemData);
      resize(rectangle, handle, move, { shift: true });
      const element = h.elements[0];
      expect([element.width, element.height]).toEqual(dimensions);
      expect([element.x, element.y]).toEqual(topLeft);
    },
  );

  it.each`
    handle  | move           | dimensions    | topLeft
    ${"nw"} | ${[0, 120]}    | ${[100, 100]} | ${[0, 100]}
    ${"ne"} | ${[-120, 0]}   | ${[100, 100]} | ${[-100, 0]}
    ${"sw"} | ${[200, -200]} | ${[100, 100]} | ${[100, -100]}
    ${"n"}  | ${[_, 150]}    | ${[50, 50]}   | ${[25, 100]}
  `(
    "Flips while resizing and keeping side ratios on handle $handle",
    async ({ handle, move, dimensions, topLeft }) => {
      await render(<App />);
      const rectangle = UI.createElement("rectangle", elemData);
      resize(rectangle, handle, move, { shift: true });
      const element = h.elements[0];
      expect([element.width, element.height]).toEqual(dimensions);
      expect([element.x, element.y]).toEqual(topLeft);
    },
  );

  it.each`
    handle  | move          | dimensions    | topLeft
    ${"ne"} | ${[50, -100]} | ${[200, 300]} | ${[-50, -100]}
    ${"s"}  | ${[_, -20]}   | ${[100, 60]}  | ${[0, 20]}
  `(
    "Resizes from center on handle $handle",
    async ({ handle, move, dimensions, topLeft }) => {
      await render(<App />);
      const rectangle = UI.createElement("rectangle", elemData);
      resize(rectangle, handle, move, { alt: true });
      const element = h.elements[0];
      expect([element.width, element.height]).toEqual(dimensions);
      expect([element.x, element.y]).toEqual(topLeft);
    },
  );

  it.each`
    handle  | move          | dimensions    | topLeft
    ${"nw"} | ${[100, 120]} | ${[140, 140]} | ${[-20, -20]}
    ${"e"}  | ${[-130, _]}  | ${[160, 160]} | ${[-30, -30]}
  `(
    "Resizes from center, flips and keeps side rations on handle $handle",
    async ({ handle, move, dimensions, topLeft }) => {
      await render(<App />);
      const rectangle = UI.createElement("rectangle", elemData);
      resize(rectangle, handle, move, { alt: true, shift: true });
      const element = h.elements[0];
      expect([element.width, element.height]).toEqual(dimensions);
      expect([element.x, element.y]).toEqual(topLeft);
    },
  );
});

describe("Test text element", () => {
  it("should update font size via keyboard", async () => {
    await render(<ExcalidrawApp />);

    const textElement = API.createElement({
      type: "text",
      text: "abc",
    });

    window.h.elements = [textElement];

    API.setSelectedElements([textElement]);

    const origFontSize = textElement.fontSize;

    Keyboard.withModifierKeys({ shift: true, ctrl: true }, () => {
      Keyboard.keyDown(KEYS.CHEVRON_RIGHT);
      expect((window.h.elements[0] as ExcalidrawTextElement).fontSize).toBe(
        origFontSize * 1.1,
      );
      Keyboard.keyDown(KEYS.CHEVRON_LEFT);
      expect((window.h.elements[0] as ExcalidrawTextElement).fontSize).toBe(
        origFontSize,
      );
    });
  });
});
