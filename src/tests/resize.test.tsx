import ReactDOM from "react-dom";
import { render } from "./test-utils";
import { reseed } from "../random";
import { UI, Keyboard, Pointer } from "./helpers/ui";
import type {
  ExcalidrawTextElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
} from "../element/types";
import type { Point } from "../types";
import { Bounds, getElementPointsCoords } from "../element/bounds";
import { Excalidraw } from "../packages/excalidraw/index";
import { API } from "./helpers/api";
import { KEYS } from "../keys";
import { isLinearElement } from "../element/typeChecks";

ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const { h } = window;
const mouse = new Pointer("mouse");

const getBoundsFromPoints = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
): Bounds => {
  if (isLinearElement(element)) {
    return getElementPointsCoords(element, element.points);
  }

  const { x, y, points } = element;
  const pointsX = points.map(([x]) => x);
  const pointsY = points.map(([, y]) => y);

  return [
    Math.min(...pointsX) + x,
    Math.min(...pointsY) + y,
    Math.max(...pointsX) + x,
    Math.max(...pointsY) + y,
  ];
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();

  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;

  // The bounds of hand-drawn linear elements may change after flipping, so
  // removing this style for testing
  UI.clickTool("arrow");
  UI.clickByTitle("Architect");
  UI.clickTool("selection");
});

describe("generic element", () => {
  // = rectangle/diamond/ellipse

  describe("resizes", () => {
    it.each`
      handle  | move          | size          | xy
      ${"n"}  | ${[10, -27]}  | ${[200, 127]} | ${[0, -27]}
      ${"e"}  | ${[67, -45]}  | ${[267, 100]} | ${[0, 0]}
      ${"s"}  | ${[-50, -39]} | ${[200, 61]}  | ${[0, 0]}
      ${"w"}  | ${[20, 90]}   | ${[180, 100]} | ${[20, 0]}
      ${"ne"} | ${[5, -33]}   | ${[205, 133]} | ${[0, -33]}
      ${"se"} | ${[-30, -81]} | ${[170, 19]}  | ${[0, 0]}
      ${"sw"} | ${[37, 25]}   | ${[163, 125]} | ${[37, 0]}
      ${"nw"} | ${[-34, 42]}  | ${[234, 58]}  | ${[-34, 42]}
    `(
      "with handle $handle",
      async ({ handle, move, size: [width, height], xy: [x, y] }) => {
        const rectangle = UI.createElement("rectangle", {
          width: 200,
          height: 100,
        });
        UI.resize(rectangle, handle, move);

        expect(rectangle.x).toBeCloseTo(x);
        expect(rectangle.y).toBeCloseTo(y);
        expect(rectangle.width).toBeCloseTo(width);
        expect(rectangle.height).toBeCloseTo(height);
        expect(rectangle.angle).toBeCloseTo(0);
      },
    );
  });

  describe("flips while resizing", () => {
    it.each`
      handle  | move           | size          | xy
      ${"n"}  | ${[15, 139]}   | ${[200, 39]}  | ${[0, 100]}
      ${"e"}  | ${[-245, 67]}  | ${[45, 100]}  | ${[-45, 0]}
      ${"s"}  | ${[-26, -210]} | ${[200, 110]} | ${[0, -110]}
      ${"w"}  | ${[241, 0]}    | ${[41, 100]}  | ${[200, 0]}
      ${"ne"} | ${[-250, 125]} | ${[50, 25]}   | ${[-50, 100]}
      ${"se"} | ${[-283, -58]} | ${[83, 42]}   | ${[-83, 0]}
      ${"sw"} | ${[40, -123]}  | ${[160, 23]}  | ${[40, -23]}
      ${"nw"} | ${[270, 133]}  | ${[70, 33]}   | ${[200, 100]}
    `(
      "with handle $handle",
      async ({ handle, move, size: [width, height], xy: [x, y] }) => {
        const rectangle = UI.createElement("rectangle", {
          width: 200,
          height: 100,
        });
        UI.resize(rectangle, handle, move);

        expect(rectangle.x).toBeCloseTo(x);
        expect(rectangle.y).toBeCloseTo(y);
        expect(rectangle.width).toBeCloseTo(width);
        expect(rectangle.height).toBeCloseTo(height);
        expect(rectangle.angle).toBeCloseTo(0);
      },
    );
  });

  it("resizes with locked aspect ratio", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    UI.resize(rectangle, "se", [100, 10], { shift: true });

    expect(rectangle.x).toBeCloseTo(0);
    expect(rectangle.y).toBeCloseTo(0);
    expect(rectangle.width).toBeCloseTo(300);
    expect(rectangle.height).toBeCloseTo(150);
    expect(rectangle.angle).toBeCloseTo(0);

    UI.resize(rectangle, "n", [30, 50], { shift: true });

    expect(rectangle.x).toBeCloseTo(50);
    expect(rectangle.y).toBeCloseTo(50);
    expect(rectangle.width).toBeCloseTo(200);
    expect(rectangle.height).toBeCloseTo(100);
    expect(rectangle.angle).toBeCloseTo(0);
  });

  it("resizes from center", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    UI.resize(rectangle, "nw", [20, 10], { alt: true });

    expect(rectangle.x).toBeCloseTo(20);
    expect(rectangle.y).toBeCloseTo(10);
    expect(rectangle.width).toBeCloseTo(160);
    expect(rectangle.height).toBeCloseTo(80);
    expect(rectangle.angle).toBeCloseTo(0);

    UI.resize(rectangle, "e", [15, 43], { alt: true });

    expect(rectangle.x).toBeCloseTo(5);
    expect(rectangle.y).toBeCloseTo(10);
    expect(rectangle.width).toBeCloseTo(190);
    expect(rectangle.height).toBeCloseTo(80);
    expect(rectangle.angle).toBeCloseTo(0);
  });

  it("resizes with bound arrow", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    const arrow = UI.createElement("arrow", {
      x: -30,
      y: 50,
      width: 28,
      height: 5,
    });

    expect(arrow.endBinding?.elementId).toEqual(rectangle.id);

    UI.resize(rectangle, "e", [40, 0]);

    expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(30);

    UI.resize(rectangle, "w", [50, 0]);

    expect(arrow.endBinding?.elementId).toEqual(rectangle.id);
    expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(80);
  });

  it("resizes with a label", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    await UI.editText(rectangle, "Hello world");
    const label = h.elements[1] as ExcalidrawTextElement;
    UI.resize(rectangle, "se", [50, 50]);

    expect(label.x + label.width / 2).toBeCloseTo(
      rectangle.x + rectangle.width / 2,
    );
    expect(label.y + label.height / 2).toBeCloseTo(
      rectangle.y + rectangle.height / 2,
    );
    expect(label.angle).toBeCloseTo(rectangle.angle);
    expect(label.fontSize).toEqual(20);

    UI.resize(rectangle, "w", [190, 0]);

    expect(label.x + label.width / 2).toBeCloseTo(
      rectangle.x + rectangle.width / 2,
    );
    expect(label.y + label.height / 2).toBeCloseTo(
      rectangle.y + rectangle.height / 2,
    );
    expect(label.angle).toBeCloseTo(rectangle.angle);
    expect(label.fontSize).toEqual(20);
  });
});

describe.each(["line", "freedraw"] as const)("%s element", (type) => {
  const points: Record<typeof type, Point[]> = {
    line: [
      [0, 0],
      [60, -20],
      [20, 40],
      [-40, 0],
    ],
    freedraw: [
      [0, 0],
      [-2.474600807561444, 41.021700699972],
      [3.6627956000014024, 47.84174560617245],
      [40.495224145598115, 47.15909710753482],
    ],
  };

  it("resizes", async () => {
    const element = UI.createElement(type, { points: points[type] });
    const bounds = getBoundsFromPoints(element);

    UI.resize(element, "ne", [30, -60]);
    const newBounds = getBoundsFromPoints(element);

    expect(newBounds[0]).toBeCloseTo(bounds[0]);
    expect(newBounds[1]).toBeCloseTo(bounds[1] - 60);
    expect(newBounds[2]).toBeCloseTo(bounds[2] + 30);
    expect(newBounds[3]).toBeCloseTo(bounds[3]);
    expect(element.angle).toBeCloseTo(0);
  });

  it("flips while resizing", async () => {
    const element = UI.createElement(type, { points: points[type] });
    const bounds = getBoundsFromPoints(element);

    UI.resize(element, "sw", [140, -80]);
    const newBounds = getBoundsFromPoints(element);

    expect(newBounds[0]).toBeCloseTo(bounds[2]);
    expect(newBounds[1]).toBeCloseTo(bounds[3] - 80);
    expect(newBounds[2]).toBeCloseTo(bounds[0] + 140);
    expect(newBounds[3]).toBeCloseTo(bounds[1]);
    expect(element.angle).toBeCloseTo(0);
  });

  it("resizes with locked aspect ratio", async () => {
    const element = UI.createElement(type, { points: points[type] });
    const bounds = getBoundsFromPoints(element);

    UI.resize(element, "ne", [30, -60], { shift: true });
    const newBounds = getBoundsFromPoints(element);
    const scale = 1 + 60 / (bounds[3] - bounds[1]);

    expect(newBounds[0]).toBeCloseTo(bounds[0]);
    expect(newBounds[1]).toBeCloseTo(bounds[1] - 60);
    expect(newBounds[2]).toBeCloseTo(
      bounds[0] + (bounds[2] - bounds[0]) * scale,
    );
    expect(newBounds[3]).toBeCloseTo(bounds[3]);
    expect(element.angle).toBeCloseTo(0);
  });

  it("resizes from center", async () => {
    const element = UI.createElement(type, { points: points[type] });
    const bounds = getBoundsFromPoints(element);

    UI.resize(element, "nw", [-20, -30], { alt: true });
    const newBounds = getBoundsFromPoints(element);

    expect(newBounds[0]).toBeCloseTo(bounds[0] - 20);
    expect(newBounds[1]).toBeCloseTo(bounds[1] - 30);
    expect(newBounds[2]).toBeCloseTo(bounds[2] + 20);
    expect(newBounds[3]).toBeCloseTo(bounds[3] + 30);
    expect(element.angle).toBeCloseTo(0);
  });
});

describe("arrow element", () => {
  it("resizes with a label", async () => {
    const arrow = UI.createElement("arrow", {
      points: [
        [0, 0],
        [40, 140],
        [80, 60], // label's anchor
        [180, 20],
        [200, 120],
      ],
    });
    await UI.editText(arrow, "Hello");
    const label = h.elements[1] as ExcalidrawTextElement;
    UI.resize(arrow, "se", [50, 30]);

    expect(label.x + label.width / 2).toBeCloseTo(arrow.x + arrow.points[2][0]);
    expect(label.y + label.height / 2).toBeCloseTo(
      arrow.y + arrow.points[2][1],
    );
    expect(label.angle).toBeCloseTo(0);
    expect(label.fontSize).toEqual(20);

    UI.resize(arrow, "w", [20, 0]);

    expect(label.x + label.width / 2).toBeCloseTo(arrow.x + arrow.points[2][0]);
    expect(label.y + label.height / 2).toBeCloseTo(
      arrow.y + arrow.points[2][1],
    );
    expect(label.angle).toBeCloseTo(0);
    expect(label.fontSize).toEqual(20);
  });
});

describe("text element", () => {
  it("resizes", async () => {
    const text = UI.createElement("text");
    await UI.editText(text, "hello\nworld");
    const { width, height, fontSize } = text;
    const scale = 40 / height + 1;
    UI.resize(text, "se", [30, 40]);

    expect(text.x).toBeCloseTo(0);
    expect(text.y).toBeCloseTo(0);
    expect(text.width).toBeCloseTo(width * scale);
    expect(text.height).toBeCloseTo(height * scale);
    expect(text.angle).toBeCloseTo(0);
    expect(text.fontSize).toBeCloseTo(fontSize * scale);
  });

  // TODO enable this test after adding single text element flipping
  it.skip("flips while resizing", async () => {
    const text = UI.createElement("text");
    await UI.editText(text, "hello\nworld");
    const { width, height, fontSize } = text;
    const scale = 100 / width - 1;
    UI.resize(text, "nw", [100, 80]);

    expect(text.x).toBeCloseTo(width);
    expect(text.y).toBeCloseTo(height);
    expect(text.width).toBeCloseTo(width * scale);
    expect(text.height).toBeCloseTo(height * scale);
    expect(text.angle).toBeCloseTo(0);
    expect(text.fontSize).toBeCloseTo(fontSize * scale);
  });

  // TODO enable this test after fixing text resizing from center
  it.skip("resizes from center", async () => {
    const text = UI.createElement("text");
    await UI.editText(text, "hello\nworld");
    const { x, y, width, height, fontSize } = text;
    const scale = 80 / height + 1;
    UI.resize(text, "nw", [-25, -40], { alt: true });

    expect(text.x).toBeCloseTo(x - ((scale - 1) * width) / 2);
    expect(text.y).toBeCloseTo(y - 40);
    expect(text.width).toBeCloseTo(width * scale);
    expect(text.height).toBeCloseTo(height * scale);
    expect(text.angle).toBeCloseTo(0);
    expect(text.fontSize).toBeCloseTo(fontSize * scale);
  });

  it("resizes with bound arrow", async () => {
    const text = UI.createElement("text");
    await UI.editText(text, "hello\nworld");
    const boundArrow = UI.createElement("arrow", {
      x: -30,
      y: 25,
      width: 28,
      height: 5,
    });

    expect(boundArrow.endBinding?.elementId).toEqual(text.id);

    UI.resize(text, "ne", [40, 0]);

    expect(boundArrow.width + boundArrow.endBinding!.gap).toBeCloseTo(30);

    const textWidth = text.width;
    const scale = 20 / text.height;
    UI.resize(text, "nw", [50, 20]);

    expect(boundArrow.endBinding?.elementId).toEqual(text.id);
    expect(boundArrow.width + boundArrow.endBinding!.gap).toBeCloseTo(
      30 + textWidth * scale,
    );
  });

  it("updates font size via keyboard", async () => {
    const text = UI.createElement("text");
    await UI.editText(text, "abc");
    const { fontSize } = text;
    mouse.select(text);

    Keyboard.withModifierKeys({ shift: true, ctrl: true }, () => {
      Keyboard.keyDown(KEYS.CHEVRON_RIGHT);
      expect(text.fontSize).toBe(fontSize * 1.1);

      Keyboard.keyDown(KEYS.CHEVRON_LEFT);
      expect(text.fontSize).toBe(fontSize);
    });
  });
});

describe("image element", () => {
  it("resizes", async () => {
    const image = API.createElement({ type: "image", width: 100, height: 100 });
    h.elements = [image];
    UI.resize(image, "ne", [-20, -30]);

    expect(image.x).toBeCloseTo(0);
    expect(image.y).toBeCloseTo(-30);
    expect(image.width).toBeCloseTo(130);
    expect(image.height).toBeCloseTo(130);
    expect(image.angle).toBeCloseTo(0);
    expect(image.scale).toEqual([1, 1]);
  });

  it("flips while resizing", async () => {
    const image = API.createElement({ type: "image", width: 100, height: 100 });
    h.elements = [image];
    UI.resize(image, "sw", [150, -150]);

    expect(image.x).toBeCloseTo(100);
    expect(image.y).toBeCloseTo(-50);
    expect(image.width).toBeCloseTo(50);
    expect(image.height).toBeCloseTo(50);
    expect(image.angle).toBeCloseTo(0);
    expect(image.scale).toEqual([-1, -1]);
  });

  it("resizes with locked/unlocked aspect ratio", async () => {
    const image = API.createElement({ type: "image", width: 100, height: 100 });
    h.elements = [image];
    UI.resize(image, "ne", [30, -20]);

    expect(image.x).toBeCloseTo(0);
    expect(image.y).toBeCloseTo(-30);
    expect(image.width).toBeCloseTo(130);
    expect(image.height).toBeCloseTo(130);

    UI.resize(image, "ne", [-30, 50], { shift: true });

    expect(image.x).toBeCloseTo(0);
    expect(image.y).toBeCloseTo(20);
    expect(image.width).toBeCloseTo(100);
    expect(image.height).toBeCloseTo(80);
  });

  it("resizes from center", async () => {
    const image = API.createElement({ type: "image", width: 100, height: 100 });
    h.elements = [image];
    UI.resize(image, "nw", [25, 15], { alt: true });

    expect(image.x).toBeCloseTo(15);
    expect(image.y).toBeCloseTo(15);
    expect(image.width).toBeCloseTo(70);
    expect(image.height).toBeCloseTo(70);
    expect(image.angle).toBeCloseTo(0);
    expect(image.scale).toEqual([1, 1]);
  });

  it("resizes with bound arrow", async () => {
    const image = API.createElement({
      type: "image",
      width: 100,
      height: 100,
    });
    h.elements = [image];
    const arrow = UI.createElement("arrow", {
      x: -30,
      y: 50,
      width: 28,
      height: 5,
    });

    expect(arrow.endBinding?.elementId).toEqual(image.id);

    UI.resize(image, "ne", [40, 0]);

    expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(30);

    const imageWidth = image.width;
    const scale = 20 / image.height;
    UI.resize(image, "nw", [50, 20]);

    expect(arrow.endBinding?.elementId).toEqual(image.id);
    expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(
      30 + imageWidth * scale,
    );
  });
});

test.todo("multiple elements");
