import ReactDOM from "react-dom";
import { render } from "./test-utils";
import App from "../components/App";
import { defaultLang, setLanguage } from "../i18n";
import { UI, Pointer } from "./helpers/ui";
import { API } from "./helpers/api";
import { actionFlipHorizontal, actionFlipVertical } from "../actions";

const { h } = window;

const mouse = new Pointer("mouse");

beforeEach(async () => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
  mouse.reset();

  await setLanguage(defaultLang);
  await render(<App />);
});

const createAndSelectOneRectangle = (angle: number = 0) => {
  UI.createElement("rectangle", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneDiamond = (angle: number = 0) => {
  UI.createElement("diamond", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneEllipse = (angle: number = 0) => {
  UI.createElement("ellipse", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneArrow = (angle: number = 0) => {
  UI.createElement("arrow", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndSelectOneLine = (angle: number = 0) => {
  UI.createElement("line", {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle,
  });
};

const createAndReturnOneDraw = (angle: number = 0) => {
  return UI.createElement("freedraw", {
    x: 0,
    y: 0,
    width: 50,
    height: 100,
    angle,
  });
};

// Rectangle element

it("flips an unrotated rectangle horizontally correctly", () => {
  createAndSelectOneRectangle();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips an unrotated rectangle vertically correctly", () => {
  createAndSelectOneRectangle();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips a rotated rectangle horizontally correctly", () => {
  const originalAngle = (3 * Math.PI) / 4;
  const expectedAngle = (5 * Math.PI) / 4;

  createAndSelectOneRectangle(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

it("flips a rotated rectangle vertically correctly", () => {
  const originalAngle = (3 * Math.PI) / 4;
  const expectedAgnle = Math.PI / 4;

  createAndSelectOneRectangle(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAgnle);
});

// Diamond element

it("flips an unrotated diamond horizontally correctly", () => {
  createAndSelectOneDiamond();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips an unrotated diamond vertically correctly", () => {
  createAndSelectOneDiamond();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips a rotated diamond horizontally correctly", () => {
  const originalAngle = (5 * Math.PI) / 4;
  const expectedAngle = (3 * Math.PI) / 4;

  createAndSelectOneDiamond(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

it("flips a rotated diamond vertically correctly", () => {
  const originalAngle = (5 * Math.PI) / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  createAndSelectOneDiamond(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Ellipse element

it("flips an unrotated ellipse horizontally correctly", () => {
  createAndSelectOneEllipse();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips an unrotated ellipse vertically correctly", () => {
  createAndSelectOneEllipse();

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips a rotated ellipse horizontally correctly", () => {
  const originalAngle = (7 * Math.PI) / 4;
  const expectedAngle = Math.PI / 4;

  createAndSelectOneEllipse(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

it("flips a rotated ellipse vertically correctly", () => {
  const originalAngle = (7 * Math.PI) / 4;
  const expectedAngle = (5 * Math.PI) / 4;

  createAndSelectOneEllipse(originalAngle);

  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if x position did not change
  expect(API.getSelectedElements()[0].x).toEqual(0);

  expect(API.getSelectedElements()[0].y).toEqual(0);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Arrow element

it("flips an unrotated arrow horizontally correctly", () => {
  createAndSelectOneArrow();

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips an unrotated arrow vertically correctly", () => {
  createAndSelectOneArrow();

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

//@TODO fix the tests with rotation
it.skip("flips a rotated arrow horizontally correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;
  createAndSelectOneArrow(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

it.skip("flips a rotated arrow vertically correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (3 * Math.PI) / 4;
  createAndSelectOneArrow(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Line element

it("flips an unrotated line horizontally correctly", () => {
  createAndSelectOneLine();

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it("flips an unrotated line vertically correctly", () => {
  createAndSelectOneLine();

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);
});

it.skip("flips a rotated line horizontally correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  createAndSelectOneLine(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

it.skip("flips a rotated line vertically correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (3 * Math.PI) / 4;

  createAndSelectOneLine(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toEqual(originalWidth);

  expect(API.getSelectedElements()[0].height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Draw element

it("flips an unrotated drawing horizontally correctly", () => {
  const draw = createAndReturnOneDraw();
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  const originalWidth = draw.width;
  const originalHeight = draw.height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(draw.width).toEqual(originalWidth);

  expect(draw.height).toEqual(originalHeight);
});

it("flips an unrotated drawing vertically correctly", () => {
  const draw = createAndReturnOneDraw();
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  const originalWidth = draw.width;
  const originalHeight = draw.height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(draw.width).toEqual(originalWidth);

  expect(draw.height).toEqual(originalHeight);
});

it("flips a rotated drawing horizontally correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  const draw = createAndReturnOneDraw(originalAngle);
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  const originalWidth = draw.width;
  const originalHeight = draw.height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(draw.width).toEqual(originalWidth);

  expect(draw.height).toEqual(originalHeight);

  // Check angle
  expect(draw.angle).toBeCloseTo(expectedAngle);
});

it("flips a rotated drawing vertically correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (3 * Math.PI) / 4;

  const draw = createAndReturnOneDraw(originalAngle);
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  const originalWidth = draw.width;
  const originalHeight = draw.height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElement().width).toEqual(originalWidth);

  expect(API.getSelectedElement().height).toEqual(originalHeight);

  // Check angle
  expect(API.getSelectedElement().angle).toBeCloseTo(expectedAngle);
});
