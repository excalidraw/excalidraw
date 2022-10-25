import ReactDOM from "react-dom";
import { GlobalTestState, render, waitFor } from "./test-utils";
import { defaultLang, setLanguage } from "../i18n";
import { UI, Pointer } from "./helpers/ui";
import { API } from "./helpers/api";
import { actionFlipHorizontal, actionFlipVertical } from "../actions";
import { getElementBounds } from "../element/bounds";
import { ExcalidrawElement, FileId } from "../element/types";
import { newLinearElement } from "../element";
import ExcalidrawApp from "../excalidraw-app";
import { mutateElement } from "../element/mutateElement";

const { h } = window;

const mouse = new Pointer("mouse");

beforeEach(async () => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
  mouse.reset();

  await setLanguage(defaultLang);
  await render(<ExcalidrawApp />);
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

const createLinearElementsWithCurveOutsideMinMaxPoints = (
  type: "line" | "arrow",
  extraProps: any = {},
) => {
  return newLinearElement({
    type,
    x: -1388.6555370382996,
    y: 1037.698247710191,
    width: 591.2804897585779,
    height: 69.32871961377737,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    strokeSharpness: "round",
    seed: 991686529,
    version: 658,
    versionNonce: 106996975,
    boundElements: null,
    link: null,
    locked: false,
    points: [
      [0, 0],
      [-584.1485186423079, -15.365636022723947],
      [-591.2804897585779, 36.09360810181511],
      [-148.56510566829502, 53.96308359105342],
    ],
    startArrowhead: null,
    endArrowhead: null,
    ...extraProps,
  });
};

const checkElementsBoundingBox = async (
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  toleranceInPx: number = 0,
) => {
  const [x1, y1, x2, y2] = getElementBounds(element1);

  const [x12, y12, x22, y22] = getElementBounds(element2);

  await waitFor(() => {
    // Check if width and height did not change
    expect(x1 - toleranceInPx <= x12 && x12 <= x1 + toleranceInPx).toEqual(
      true,
    );
    expect(y1 - toleranceInPx <= y12 && y12 <= y1 + toleranceInPx).toEqual(
      true,
    );
    expect(x2 - toleranceInPx <= x22 && x22 <= x2 + toleranceInPx).toEqual(
      true,
    );
    expect(y2 - toleranceInPx <= y22 && y22 <= y2 + toleranceInPx).toEqual(
      true,
    );
  });
};

const checkHorizontalFlip = async (toleranceInPx: number = 0.00001) => {
  const originalElement = { ...h.elements[0] };
  h.app.actionManager.executeAction(actionFlipHorizontal);
  const newElement = h.elements[0];
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkRotatedHorizontalFlip = async (
  expectedAngle: number,
  toleranceInPx: number = 0.00001,
) => {
  const originalElement = { ...h.elements[0] };
  h.app.actionManager.executeAction(actionFlipHorizontal);
  const newElement = h.elements[0];
  expect(newElement.angle).toBeCloseTo(expectedAngle);
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkRotatedVerticalFlip = async (
  expectedAngle: number,
  toleranceInPx: number = 0.00001,
) => {
  const originalElement = { ...h.elements[0] };
  h.app.actionManager.executeAction(actionFlipVertical);
  const newElement = h.elements[0];
  expect(newElement.angle).toBeCloseTo(expectedAngle);
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const checkVerticalFlip = async (toleranceInPx: number = 0.00001) => {
  const originalElement = { ...h.elements[0] };

  h.app.actionManager.executeAction(actionFlipVertical);

  const newElement = h.elements[0];
  await checkElementsBoundingBox(originalElement, newElement, toleranceInPx);
};

const FLIP_PRECISION_DECIMALS = 7;
const LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS = 5;

// Rectangle element

it("flips an unrotated rectangle horizontally correctly", async () => {
  createAndSelectOneRectangle();

  await checkHorizontalFlip();
});

it("flips an unrotated rectangle vertically correctly", async () => {
  createAndSelectOneRectangle();

  await checkVerticalFlip();
});

it("flips a rotated rectangle horizontally correctly", async () => {
  const originalAngle = (3 * Math.PI) / 4;
  const expectedAngle = (5 * Math.PI) / 4;

  createAndSelectOneRectangle(originalAngle);

  await checkRotatedHorizontalFlip(expectedAngle);
});

it("flips a rotated rectangle vertically correctly", async () => {
  const originalAngle = (3 * Math.PI) / 4;
  const expectedAgnle = Math.PI / 4;

  createAndSelectOneRectangle(originalAngle);

  await checkRotatedVerticalFlip(expectedAgnle);
});

// Diamond element

it("flips an unrotated diamond horizontally correctly", async () => {
  createAndSelectOneDiamond();

  await checkHorizontalFlip();
});

it("flips an unrotated diamond vertically correctly", async () => {
  createAndSelectOneDiamond();

  await checkVerticalFlip();
});

it("flips a rotated diamond horizontally correctly", async () => {
  const originalAngle = (5 * Math.PI) / 4;
  const expectedAngle = (3 * Math.PI) / 4;

  createAndSelectOneDiamond(originalAngle);

  await checkRotatedHorizontalFlip(expectedAngle);
});

it("flips a rotated diamond vertically correctly", async () => {
  const originalAngle = (5 * Math.PI) / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  createAndSelectOneDiamond(originalAngle);

  await checkRotatedVerticalFlip(expectedAngle);
});

// Ellipse element

it("flips an unrotated ellipse horizontally correctly", async () => {
  createAndSelectOneEllipse();

  await checkHorizontalFlip();
});

it("flips an unrotated ellipse vertically correctly", async () => {
  createAndSelectOneEllipse();

  await checkVerticalFlip();
});

it("flips a rotated ellipse horizontally correctly", async () => {
  const originalAngle = (7 * Math.PI) / 4;
  const expectedAngle = Math.PI / 4;

  createAndSelectOneEllipse(originalAngle);

  await checkRotatedHorizontalFlip(expectedAngle);
});

it("flips a rotated ellipse vertically correctly", async () => {
  const originalAngle = (7 * Math.PI) / 4;
  const expectedAngle = (5 * Math.PI) / 4;

  createAndSelectOneEllipse(originalAngle);

  await checkRotatedVerticalFlip(expectedAngle);
});

// Arrow element

it("flips an unrotated arrow horizontally correctly", async () => {
  createAndSelectOneArrow();
  await checkHorizontalFlip(LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
});

//TODO: elements with curve outside minMax points have a wrong bounding box!!!
it.skip("flips an unrotated arrow horizontally with line outside min/max points bounds", async () => {
  const arrow = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
  h.app.scene.replaceAllElements([arrow]);
  h.app.state.selectedElementIds[arrow.id] = true;
  await checkHorizontalFlip(LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
});

it("flips an unrotated arrow vertically correctly", async () => {
  createAndSelectOneArrow();
  await checkVerticalFlip(LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
});

//@TODO fix the tests with rotation
it.skip("flips a rotated arrow horizontally correctly", async () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;
  const arrow = createLinearElementsWithCurveOutsideMinMaxPoints("arrow");
  h.app.scene.replaceAllElements([arrow]);
  h.app.state.selectedElementIds[arrow.id] = true;
  mutateElement(arrow, {
    angle: originalAngle,
  });
  await checkRotatedHorizontalFlip(
    expectedAngle,
    LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS,
  );
});

it.skip("flips a rotated arrow vertically correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (3 * Math.PI) / 4;
  createAndSelectOneArrow(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipVertical);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toBeCloseTo(
    originalWidth,
    FLIP_PRECISION_DECIMALS,
  );

  expect(API.getSelectedElements()[0].height).toBeCloseTo(
    originalHeight,
    FLIP_PRECISION_DECIMALS,
  );

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Line element

it("flips an unrotated line horizontally correctly", async () => {
  createAndSelectOneLine();
  await checkHorizontalFlip(LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
});
//TODO: elements with curve outside minMax points have a wrong bounding box
it.skip("flips an unrotated line horizontally with line outside min/max points bounds", async () => {
  const arrow = createLinearElementsWithCurveOutsideMinMaxPoints("line");
  h.app.scene.replaceAllElements([arrow]);
  h.app.state.selectedElementIds[arrow.id] = true;
  await checkHorizontalFlip(10);
});

it("flips an unrotated line vertically correctly", async () => {
  createAndSelectOneLine();
  await checkVerticalFlip(LINEAR_ELEMENT_FLIP_TOLERANCE_IN_PIXELS);
});

it.skip("flips a rotated line horizontally correctly", () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  createAndSelectOneLine(originalAngle);

  const originalWidth = API.getSelectedElements()[0].width;
  const originalHeight = API.getSelectedElements()[0].height;

  h.app.actionManager.executeAction(actionFlipHorizontal);

  // Check if width and height did not change
  expect(API.getSelectedElements()[0].width).toBeCloseTo(
    originalWidth,
    FLIP_PRECISION_DECIMALS,
  );

  expect(API.getSelectedElements()[0].height).toBeCloseTo(
    originalHeight,
    FLIP_PRECISION_DECIMALS,
  );

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
  expect(API.getSelectedElements()[0].width).toBeCloseTo(
    originalWidth,
    FLIP_PRECISION_DECIMALS,
  );

  expect(API.getSelectedElements()[0].height).toBeCloseTo(
    originalHeight,
    FLIP_PRECISION_DECIMALS,
  );

  // Check angle
  expect(API.getSelectedElements()[0].angle).toBeCloseTo(expectedAngle);
});

// Draw element

it("flips an unrotated drawing horizontally correctly", async () => {
  const draw = createAndReturnOneDraw();
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;
  await checkHorizontalFlip();
});

it("flips an unrotated drawing vertically correctly", async () => {
  const draw = createAndReturnOneDraw();
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;
  await checkVerticalFlip();
});

it("flips a rotated drawing horizontally correctly", async () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (7 * Math.PI) / 4;

  const draw = createAndReturnOneDraw(originalAngle);
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  await checkRotatedHorizontalFlip(expectedAngle);
});

it("flips a rotated drawing vertically correctly", async () => {
  const originalAngle = Math.PI / 4;
  const expectedAngle = (3 * Math.PI) / 4;

  const draw = createAndReturnOneDraw(originalAngle);
  // select draw, since not done automatically
  h.state.selectedElementIds[draw.id] = true;

  await checkRotatedVerticalFlip(expectedAngle);
});

//image

jest.mock("../data/blob", () => {
  const originalModule = jest.requireActual("../data/blob");

  //Mock the default export and named export 'foo'
  return {
    __esModule: true,
    ...originalModule,
    resizeImageFile: (imageFile: File) => imageFile,
    generateIdFromFile: () => "fileId" as FileId,
  };
});

const createImage = async () => {
  const sendPasteEvent = (file?: File) => {
    const clipboardEvent = new Event("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    // set `clipboardData` properties.
    // @ts-ignore
    clipboardEvent.clipboardData = {
      getData: () => window.navigator.clipboard.readText(),
      files: [file],
    };

    document.dispatchEvent(clipboardEvent);
  };

  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
  sendPasteEvent(await API.loadFile("./fixtures/smiley_embedded_v2.png"));
};

it("flips an unrotated image horizontally correctly", async () => {
  //paste image
  await createImage();
  await waitFor(() => {
    expect(API.getSelectedElements().length).toBeGreaterThan(0);
    expect(API.getSelectedElements()[0].type).toEqual("image");
    expect(h.app.files.fileId).toBeDefined();
  });

  await checkHorizontalFlip();
});

it("flips an unrotated image vertically correctly", async () => {
  //paste image
  await createImage();
  await waitFor(() => {
    expect(API.getSelectedElements().length).toBeGreaterThan(0);
    expect(API.getSelectedElements()[0].type).toEqual("image");
    expect(h.app.files.fileId).toBeDefined();
  });

  await checkVerticalFlip();
});
