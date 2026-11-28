import { Excalidraw } from "@excalidraw/excalidraw";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { CaptureUpdateAction } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

const mouse = new Pointer("mouse");

async function createConnectedShapes({
  withLabel = false,
  elbowed = false,
} = {}) {
  await render(<Excalidraw handleKeyboardGlobally />);
  const frame = API.createElement({
    id: "frame",
    type: "frame",
    x: 0,
    y: 0,
    width: 650,
    height: 360,
  });
  const source = API.createElement({
    id: "source",
    type: "rectangle",
    x: 80,
    y: 120,
    width: 160,
    height: 100,
    frameId: frame.id,
    backgroundColor: "#b2f2bb",
    boundElements: [{ id: "arrow", type: "arrow" }],
  });
  const target = API.createElement({
    id: "target",
    type: "rectangle",
    x: 410,
    y: 120,
    width: 160,
    height: 100,
    frameId: frame.id,
    backgroundColor: "#a5d8ff",
    boundElements: [{ id: "arrow", type: "arrow" }],
  });
  const arrow = API.createElement({
    id: "arrow",
    type: "arrow",
    elbowed,
    x: 242,
    y: 170,
    width: 166,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(166, 0)],
    frameId: frame.id,
    startBinding: {
      elementId: source.id,
      mode: "orbit",
      fixedPoint: [1, 0.5],
    },
    endBinding: {
      elementId: target.id,
      mode: "orbit",
      fixedPoint: [0, 0.5],
    },
    endArrowhead: "arrow",
    boundElements: withLabel ? [{ id: "label", type: "text" }] : null,
  });
  const label = API.createElement({
    id: "label",
    type: "text",
    text: "Connected",
    x: 280,
    y: 160,
    width: 90,
    height: 25,
    containerId: arrow.id,
    frameId: frame.id,
  });
  API.updateScene({
    elements: [source, target, arrow, ...(withLabel ? [label] : []), frame],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([target]);
  return { frame, source, target, arrow, label };
}

function dragTargetOutside() {
  mouse.downAt(490, 170);
  mouse.moveTo(900, 170);
  mouse.up();
}

describe("frame membership of arrows attached to moved shapes", () => {
  it("keeps an internal connector in its frame when its target moves inside", async () => {
    const { frame, target, arrow } = await createConnectedShapes();
    mouse.downAt(490, 170);
    mouse.moveTo(520, 170);
    mouse.up();
    expect(API.getElement(target).frameId).toBe(frame.id);
    expect(API.getElement(arrow)).toMatchObject({
      frameId: frame.id,
      endBinding: { elementId: target.id },
    });
  });

  it.each(["source", "target"] as const)(
    "releases the connector when its bound %s moves outside",
    async (endpoint) => {
      const { source, target, arrow } = await createConnectedShapes();
      const element = endpoint === "source" ? source : target;
      API.setSelectedElements([element]);
      mouse.downAt(element.x + element.width / 2, 170);
      mouse.moveTo(900, 170);
      mouse.up();
      expect(API.getElement(element).frameId).toBeNull();
      expect(API.getElement(arrow)).toMatchObject({
        frameId: null,
        startBinding: { elementId: source.id },
        endBinding: { elementId: target.id },
      });
    },
  );

  it("releases the connector when its target moves into another frame", async () => {
    const { frame, source, target, arrow } = await createConnectedShapes();
    const otherFrame = API.createElement({
      id: "other-frame",
      type: "frame",
      x: 760,
      y: 0,
      width: 400,
      height: 360,
    });
    API.setElements([source, target, arrow, frame, otherFrame]);

    dragTargetOutside();

    expect(API.getElement(target).frameId).toBe(otherFrame.id);
    expect(API.getElement(arrow).frameId).toBeNull();
  });

  it.each([false, true])(
    "releases the arrow label while preserving its bindings (elbowed: %s)",
    async (elbowed) => {
      const { source, target, arrow, label } = await createConnectedShapes({
        withLabel: true,
        elbowed,
      });

      dragTargetOutside();

      expect(API.getElement(label)).toMatchObject({
        frameId: null,
        containerId: arrow.id,
        text: "Connected",
      });
      expect(API.getElement(arrow)).toMatchObject({
        frameId: null,
        boundElements: [{ id: label.id, type: "text" }],
        startBinding: { elementId: source.id },
        endBinding: { elementId: target.id },
      });
    },
  );

  it("keeps bindings to the containing frame when moving inside, then releases on exit", async () => {
    const { frame, source, target, arrow } = await createConnectedShapes();
    API.updateElement(source, { boundElements: null });
    API.updateElement(frame, {
      boundElements: [{ id: arrow.id, type: "arrow" }],
    });
    API.updateElement(arrow, {
      startBinding: {
        elementId: frame.id,
        mode: "orbit",
        fixedPoint: [0.3, 0.5],
      },
    });

    mouse.downAt(490, 170);
    mouse.moveTo(520, 170);
    mouse.up();
    expect(API.getElement(arrow).frameId).toBe(frame.id);

    mouse.downAt(520, 170);
    mouse.moveTo(900, 170);
    mouse.up();
    expect(API.getElement(arrow)).toMatchObject({
      frameId: null,
      startBinding: { elementId: frame.id },
      endBinding: { elementId: target.id },
    });
  });

  it("keeps the connector when its target still overlaps the frame", async () => {
    const { frame, target, arrow } = await createConnectedShapes();
    mouse.downAt(490, 170);
    mouse.moveTo(600, 170);
    mouse.up();

    expect(API.getElement(target).frameId).toBe(frame.id);
    expect(API.getElement(arrow).frameId).toBe(frame.id);
  });

  it("restores frame membership with undo and releases it again with redo", async () => {
    const { frame, target, arrow, label } = await createConnectedShapes({
      withLabel: true,
    });
    dragTargetOutside();

    Keyboard.undo();
    expect(API.getElement(target)).toMatchObject({ x: 410, frameId: frame.id });
    expect(API.getElement(arrow).frameId).toBe(frame.id);
    expect(API.getElement(label).frameId).toBe(frame.id);

    Keyboard.redo();
    expect(API.getElement(target)).toMatchObject({ x: 820, frameId: null });
    expect(API.getElement(arrow).frameId).toBeNull();
    expect(API.getElement(label).frameId).toBeNull();
  });

  it("does not change an unrelated unbound arrow", async () => {
    const { frame, source, target, arrow } = await createConnectedShapes();
    const unrelatedArrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 280,
      width: 150,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(150, 0)],
      frameId: frame.id,
    });
    API.setElements([source, target, arrow, unrelatedArrow, frame]);

    dragTargetOutside();

    expect(API.getElement(unrelatedArrow).frameId).toBe(frame.id);
    expect(API.getElement(arrow)).toMatchObject({
      frameId: null,
      startBinding: { elementId: source.id },
      endBinding: { elementId: target.id },
    });
  });
});
