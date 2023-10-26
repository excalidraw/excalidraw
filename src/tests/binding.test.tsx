import { fireEvent, render } from "./test-utils";
import { Excalidraw } from "../../src/packages/excalidraw/index";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { getTransformHandles } from "../element/transformHandles";
import { API } from "./helpers/api";
import { KEYS } from "../keys";
import { actionWrapTextInContainer } from "../actions/actionBoundText";

const { h } = window;

const mouse = new Pointer("mouse");

describe("element binding", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should create valid binding if duplicate start/end points", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      width: 50,
      height: 50,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 0,
      width: 100,
      height: 1,
      points: [
        [0, 0],
        [0, 0],
        [100, 0],
        [100, 0],
      ],
    });
    h.elements = [rect, arrow];
    expect(arrow.startBinding).toBe(null);

    API.setSelectedElements([arrow]);

    expect(API.getSelectedElements()).toEqual([arrow]);
    mouse.downAt(100, 0);
    mouse.moveTo(55, 0);
    mouse.up(0, 0);
    expect(arrow.startBinding).toEqual({
      elementId: rect.id,
      focus: expect.toBeNonNaNNumber(),
      gap: expect.toBeNonNaNNumber(),
    });

    mouse.downAt(100, 0);
    mouse.move(-45, 0);
    mouse.up();
    expect(arrow.startBinding).toEqual({
      elementId: rect.id,
      focus: expect.toBeNonNaNNumber(),
      gap: expect.toBeNonNaNNumber(),
    });

    mouse.down();
    mouse.move(-50, 0);
    mouse.up();
    expect(arrow.startBinding).toBe(null);
    expect(arrow.endBinding).toEqual({
      elementId: rect.id,
      focus: expect.toBeNonNaNNumber(),
      gap: expect.toBeNonNaNNumber(),
    });
  });

  //@TODO fix the test with rotation
  it.skip("rotation of arrow should rebind both ends", () => {
    const rectLeft = UI.createElement("rectangle", {
      x: 0,
      width: 200,
      height: 500,
    });
    const rectRight = UI.createElement("rectangle", {
      x: 400,
      width: 200,
      height: 500,
    });
    const arrow = UI.createElement("arrow", {
      x: 210,
      y: 250,
      width: 180,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
    expect(arrow.endBinding?.elementId).toBe(rectRight.id);

    const rotation = getTransformHandles(arrow, h.state.zoom, "mouse")
      .rotation!;
    const rotationHandleX = rotation[0] + rotation[2] / 2;
    const rotationHandleY = rotation[1] + rotation[3] / 2;
    mouse.down(rotationHandleX, rotationHandleY);
    mouse.move(300, 400);
    mouse.up();
    expect(arrow.angle).toBeGreaterThan(0.7 * Math.PI);
    expect(arrow.angle).toBeLessThan(1.3 * Math.PI);
    expect(arrow.startBinding?.elementId).toBe(rectRight.id);
    expect(arrow.endBinding?.elementId).toBe(rectLeft.id);
  });

  // TODO fix & reenable once we rewrite tests to work with concurrency
  it.skip(
    "editing arrow and moving its head to bind it to element A, finalizing the" +
      "editing by clicking on element A should end up selecting A",
    async () => {
      UI.createElement("rectangle", {
        y: 0,
        size: 100,
      });
      // Create arrow bound to rectangle
      UI.clickTool("arrow");
      mouse.down(50, -100);
      mouse.up(0, 80);

      // Edit arrow with multi-point
      mouse.doubleClick();
      // move arrow head
      mouse.down();
      mouse.up(0, 10);
      expect(API.getSelectedElement().type).toBe("arrow");

      // NOTE this mouse down/up + await needs to be done in order to repro
      // the issue, due to https://github.com/excalidraw/excalidraw/blob/46bff3daceb602accf60c40a84610797260fca94/src/components/App.tsx#L740
      mouse.reset();
      expect(h.state.editingLinearElement).not.toBe(null);
      mouse.down(0, 0);
      await new Promise((r) => setTimeout(r, 100));
      expect(h.state.editingLinearElement).toBe(null);
      expect(API.getSelectedElement().type).toBe("rectangle");
      mouse.up();
      expect(API.getSelectedElement().type).toBe("rectangle");
    },
  );

  it("should bind/unbind arrow when moving it with keyboard", () => {
    const rectangle = UI.createElement("rectangle", {
      x: 75,
      y: 0,
      size: 100,
    });

    // Creates arrow 1px away from bidding with rectangle
    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding).toBe(null);

    expect(API.getSelectedElement().type).toBe("arrow");
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(arrow.endBinding).toBe(null);
  });

  it("should unbind on bound element deletion", () => {
    const rectangle = UI.createElement("rectangle", {
      x: 60,
      y: 0,
      size: 100,
    });

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    mouse.select(rectangle);
    expect(API.getSelectedElement().type).toBe("rectangle");
    Keyboard.keyDown(KEYS.DELETE);
    expect(arrow.endBinding).toBe(null);
  });

  it("should unbind on text element deletion by submitting empty text", async () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
    });

    h.elements = [text];

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(text.id);

    // edit text element and submit
    // -------------------------------------------------------------------------

    UI.clickTool("text");

    mouse.clickAt(text.x + 50, text.y + 50);

    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;

    expect(editor).not.toBe(null);

    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });

    expect(
      document.querySelector(".excalidraw-textEditorContainer > textarea"),
    ).toBe(null);
    expect(arrow.endBinding).toBe(null);
  });

  it("should keep binding on text update", async () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
    });

    h.elements = [text];

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(text.id);

    // delete text element by submitting empty text
    // -------------------------------------------------------------------------

    UI.clickTool("text");

    mouse.clickAt(text.x + 50, text.y + 50);
    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;

    expect(editor).not.toBe(null);

    fireEvent.change(editor, { target: { value: "asdasdasdasdas" } });
    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });

    expect(
      document.querySelector(".excalidraw-textEditorContainer > textarea"),
    ).toBe(null);
    expect(arrow.endBinding?.elementId).toBe(text.id);
  });

  it("should update binding when text containerized", async () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      id: "rectangle1",
      width: 100,
      height: 100,
      boundElements: [
        { id: "arrow1", type: "arrow" },
        { id: "arrow2", type: "arrow" },
      ],
    });

    const arrow1 = API.createElement({
      type: "arrow",
      id: "arrow1",
      points: [
        [0, 0],
        [0, -87.45777932247563],
      ],
      startBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
      },
      endBinding: {
        elementId: "text1",
        focus: 0.2,
        gap: 7,
      },
    });

    const arrow2 = API.createElement({
      type: "arrow",
      id: "arrow2",
      points: [
        [0, 0],
        [0, -87.45777932247563],
      ],
      startBinding: {
        elementId: "text1",
        focus: 0.2,
        gap: 7,
      },
      endBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
      },
    });

    const text1 = API.createElement({
      type: "text",
      id: "text1",
      text: "ola",
      boundElements: [
        { id: "arrow1", type: "arrow" },
        { id: "arrow2", type: "arrow" },
      ],
    });

    h.elements = [rectangle1, arrow1, arrow2, text1];

    API.setSelectedElements([text1]);

    expect(h.state.selectedElementIds[text1.id]).toBe(true);

    h.app.actionManager.executeAction(actionWrapTextInContainer);

    // new text container will be placed before the text element
    const container = h.elements.at(-2)!;

    expect(container.type).toBe("rectangle");
    expect(container.id).not.toBe(rectangle1.id);

    expect(container).toEqual(
      expect.objectContaining({
        boundElements: expect.arrayContaining([
          {
            type: "text",
            id: text1.id,
          },
          {
            type: "arrow",
            id: arrow1.id,
          },
          {
            type: "arrow",
            id: arrow2.id,
          },
        ]),
      }),
    );

    expect(arrow1.startBinding?.elementId).toBe(rectangle1.id);
    expect(arrow1.endBinding?.elementId).toBe(container.id);
    expect(arrow2.startBinding?.elementId).toBe(container.id);
    expect(arrow2.endBinding?.elementId).toBe(rectangle1.id);
  });
});
