import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { PointerDownState } from "@excalidraw/excalidraw/types";
import type { LocalPoint } from "@excalidraw/math";

import { Scene } from "../src/Scene";
import { updateBoundElements } from "../src/binding";
import { dragSelectedElements } from "../src/dragElements";
import { syncInvalidIndices } from "../src/fractionalIndex";
import { LinearElementEditor } from "../src/linearElementEditor";

import type { NonDeletedExcalidrawElement } from "../src/types";

vi.mock("../src/binding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/binding")>();
  return {
    ...actual,
    updateBoundElements: vi.fn(actual.updateBoundElements),
  };
});

const pointerDownStateFor = (scene: Scene): PointerDownState => {
  const state: Pick<PointerDownState, "originalElements"> = {
    originalElements: new Map(
      scene
        .getNonDeletedElements()
        .map((element) => [element.id, { ...element }]),
    ),
  };
  return state as PointerDownState;
};

const drag = (
  scene: Scene,
  selectedElements: NonDeletedExcalidrawElement[],
  offset = { x: 20, y: 30 },
  pointerDownState = pointerDownStateFor(scene),
) => {
  dragSelectedElements(
    pointerDownState,
    selectedElements,
    offset,
    scene,
    { x: 0, y: 0 },
    null,
  );
};

const createBoundArrow = () => {
  const rectangle = API.createElement({
    id: "rectangle",
    boundElements: [{ id: "arrow", type: "arrow" }],
  });
  const arrow = API.createElement({
    type: "arrow",
    id: "arrow",
    x: 25,
    y: 25,
    width: 200,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
    startBinding: {
      elementId: rectangle.id,
      fixedPoint: [0.25, 0.25],
      mode: "inside",
    },
  });
  const scene = new Scene(syncInvalidIndices([rectangle, arrow]));
  return { scene, rectangle, arrow };
};

describe("dragSelectedElements", () => {
  afterEach(() => {
    vi.mocked(updateBoundElements).mockClear();
  });

  it("passes every bound-arrow update the same moved-element array", () => {
    const selected = [0, 1, 2].map((i) =>
      API.createElement({ x: i * 200, y: 0 }),
    );
    const scene = new Scene(syncInvalidIndices(selected));

    drag(scene, selected);

    const calls = vi.mocked(updateBoundElements).mock.calls;
    expect(calls).toHaveLength(3);
    // a fresh array per call misses the per-array id-set cache and rebuilds
    // a selection-sized set for every element
    const [[, , firstOptions]] = calls;
    expect(firstOptions?.simultaneouslyUpdated).toEqual(selected);
    for (const [, , options] of calls) {
      expect(options?.simultaneouslyUpdated).toBe(
        firstOptions?.simultaneouslyUpdated,
      );
    }
  });

  it("moves grouped elements and their bound label across z-order", () => {
    const rectangle = API.createElement({
      id: "rectangle",
      groupIds: ["group"],
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: rectangle.id,
      x: 10,
      y: 15,
      width: 80,
      height: 20,
      groupIds: ["group"],
    });
    const unrelated = API.createElement({ x: 500, y: 600 });
    const second = API.createElement({
      x: 200,
      y: 300,
      groupIds: ["group"],
    });
    const scene = new Scene(
      syncInvalidIndices([rectangle, label, unrelated, second]),
    );
    const order = scene.getNonDeletedElements().map((element) => element.id);

    drag(scene, [rectangle, second]);

    expect(scene.getNonDeletedElements().map(({ x, y }) => ({ x, y }))).toEqual(
      [
        { x: 20, y: 30 },
        { x: 30, y: 45 },
        { x: 500, y: 600 },
        { x: 220, y: 330 },
      ],
    );
    expect(scene.getNonDeletedElements().map((element) => element.id)).toEqual(
      order,
    );
  });

  it("moves a frame and its children once even when a child is also selected", () => {
    const frame = API.createElement({ type: "frame", width: 400, height: 400 });
    const selectedChild = API.createElement({ x: 10, frameId: frame.id });
    const otherChild = API.createElement({ x: 200, frameId: frame.id });
    const elements = [selectedChild, otherChild, frame];
    const scene = new Scene(syncInvalidIndices(elements));
    const versions = elements.map((element) => element.version);

    drag(scene, [frame, selectedChild]);

    expect(elements.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 30, y: 40 },
      { x: 220, y: 230 },
      { x: 20, y: 30 },
    ]);
    expect(elements.map((element) => element.version)).toEqual(
      versions.map((version) => version + 1),
    );
  });

  it("updates an unselected bound arrow", () => {
    const { scene, rectangle, arrow } = createBoundArrow();

    drag(scene, [rectangle]);

    expect(rectangle).toMatchObject({ x: 20, y: 30 });
    expect(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        0,
        scene.getNonDeletedElementsMap(),
      ),
    ).toEqual([45, 55]);
    expect(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        -1,
        scene.getNonDeletedElementsMap(),
      ),
    ).toEqual([225, 25]);
    expect(arrow.startBinding?.elementId).toBe(rectangle.id);
  });

  it("preserves bindings when translating an arrow with its attached element", () => {
    const { scene, rectangle, arrow } = createBoundArrow();
    const arrowVersion = arrow.version;
    const originalPoints = arrow.points;

    drag(scene, [rectangle, arrow]);

    expect(arrow).toMatchObject({
      x: 45,
      y: 55,
      startBinding: { elementId: rectangle.id },
      version: arrowVersion + 1,
    });
    expect(arrow.points).toBe(originalPoints);
    expect(rectangle.boundElements).toEqual([{ id: arrow.id, type: "arrow" }]);
  });

  it("unbinds a translated arrow from an unselected element", () => {
    const { scene, rectangle, arrow } = createBoundArrow();

    drag(scene, [arrow]);

    expect(arrow).toMatchObject({ x: 45, y: 55, startBinding: null });
    expect(rectangle).toMatchObject({ x: 0, y: 0, boundElements: [] });
  });

  it("does not mutate for unchanged coordinates", () => {
    const rectangle = API.createElement({});
    const second = API.createElement({ x: 200 });
    const scene = new Scene(syncInvalidIndices([rectangle, second]));
    const originalState = pointerDownStateFor(scene);
    const versions = () => [rectangle.version, second.version];
    const initial = versions();

    drag(scene, [rectangle, second], { x: 0, y: 0 }, originalState);
    expect(versions()).toEqual(initial);

    drag(scene, [rectangle, second], { x: 20, y: 30 }, originalState);
    const moved = versions();
    expect(moved).toEqual(initial.map((version) => version + 1));

    drag(scene, [rectangle, second], { x: 20, y: 30 }, originalState);
    expect(versions()).toEqual(moved);
  });
});
