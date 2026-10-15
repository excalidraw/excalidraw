import React from "react";
import rough from "roughjs/bin/rough";

import * as Element from "@excalidraw/element";
import {
  BOUND_TEXT_PADDING,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  ELEMENT_READY_TO_ERASE_OPACITY,
} from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getDefaultAppState } from "../appState";
import * as StaticScene from "../renderer/staticScene";
import { Renderer } from "../scene/Renderer";
import { exportToSvg } from "../scene/export";
import { getNormalizedZoom } from "../scene";
import { getElementRenderOffsets } from "../renderOverrides";

import { API } from "./helpers/api";
import {
  act,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type {
  AppState,
  ElementRenderOffsets,
  ElementRenderOverride,
  ElementRenderOverrides,
} from "../types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../scene/types";

const { h } = window;

afterEach(() => {
  vi.restoreAllMocks();
  restoreOriginalGetBoundingClientRect();
});

describe("setElementRenderOverrides", () => {
  const setup = async () => {
    const element = API.createElement({ type: "rectangle", opacity: 70 });
    const onChange = vi.fn();
    const mounted = await render(
      <Excalidraw initialData={{ elements: [element] }} onChange={onChange} />,
    );
    const rendering = vi.spyOn(StaticScene, "renderStaticScene");
    const submit = (snapshot: ElementRenderOverrides | null) => {
      act(() => h.app.api.setElementRenderOverrides(snapshot));
      // Equivalent snapshots need not render, but the published state remains
      // available for checking snapshot ownership and identity.
      // eslint-disable-next-line dot-notation -- inspect private state without triggering a render
      return h.app["elementRenderOverrides"];
    };
    onChange.mockClear();
    return { element: h.elements[0], onChange, rendering, submit, ...mounted };
  };

  it("copies and replaces the complete snapshot, including omitted fields", async () => {
    const { element, submit } = await setup();
    const value = { opacity: 25, offset: { x: 100, y: 20 } };
    const input = new Map([[element.id, value]]);
    const published = submit(input);
    value.opacity = 99;
    value.offset.x = 999;
    input.clear();
    expect(published.get(element.id)).toEqual({
      opacity: 25,
      offset: { x: 100, y: 20 },
    });

    const next = submit(new Map([[element.id, { offset: { x: 10, y: 0 } }]]));
    expect(
      Element.resolveElementRenderState(
        element,
        h.app.scene.getNonDeletedElementsMap(),
        {
          elementRenderOverrides: next,
          elementsPendingErasure: new Set(),
          pendingFlowchartNodes: null,
        },
      ).opacity,
    ).toBe(0.7);
    expect(submit(new Map())).toHaveLength(0);
    expect(submit(null)).toHaveLength(0);
  });

  it("rejects an invalid snapshot atomically and clamps finite opacity", async () => {
    const { element, submit, rendering } = await setup();
    const previous = submit(new Map([[element.id, { opacity: 200 }]]));
    expect(previous.get(element.id)?.opacity).toBe(100);
    rendering.mockClear();
    expect(() =>
      submit(
        new Map([
          [element.id, { opacity: 0 }],
          ["unknown", { offset: { x: Number.NaN, y: 0 } }],
        ]),
      ),
    ).toThrow(TypeError);
    expect(rendering).not.toHaveBeenCalled();
    act(() => h.app.api.updateScene({ appState: { scrollX: 1 } }));
    expect(
      rendering.mock.lastCall![0].renderConfig.elementRenderOverrides,
    ).toBe(previous);
  });

  it("drops empty entries and rejects null offsets without replacing the snapshot", async () => {
    const { element, submit, rendering } = await setup();
    const snapshot = submit(new Map([[element.id, {}]]));
    expect(snapshot.size).toBe(0);
    rendering.mockClear();
    expect(() =>
      submit(
        new Map([
          [element.id, { offset: null } as unknown as ElementRenderOverride],
        ]),
      ),
    ).toThrow(TypeError);
    expect(rendering).not.toHaveBeenCalled();
  });

  it("skips empty submissions and repeated clears, but repaints the first clear", async () => {
    const { element, submit, rendering, onChange } = await setup();
    const renders = vi.spyOn(h.app, "render");
    const empty = submit(null);
    expect(submit(new Map())).toBe(empty);
    expect(submit(new Map([[element.id, {}]]))).toBe(empty);
    expect(renders).not.toHaveBeenCalled();
    expect(rendering).not.toHaveBeenCalled();

    submit(new Map([[element.id, { opacity: 50 }]]));
    renders.mockClear();
    rendering.mockClear();
    const cleared = submit(null);
    expect(cleared.size).toBe(0);
    expect(renders).toHaveBeenCalledTimes(1);
    expect(rendering).toHaveBeenCalledTimes(1);
    expect(submit(null)).toBe(cleared);
    expect(submit(new Map([[element.id, {}]]))).toBe(cleared);
    expect(renders).toHaveBeenCalledTimes(1);
    expect(rendering).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("detects caller mutations and complete replacements in a reused map", async () => {
    const { element, submit, rendering } = await setup();
    const value = { opacity: 25, offset: { x: 10, y: 20 } };
    const input: Map<string, ElementRenderOverride> = new Map([
      [element.id, value],
    ]);
    const first = submit(input);
    rendering.mockClear();

    value.opacity = 60;
    value.offset.x = 30;
    const changed = submit(input);
    expect(changed).not.toBe(first);
    expect(changed.get(element.id)).toEqual({
      opacity: 60,
      offset: { x: 30, y: 20 },
    });
    expect(first.get(element.id)).toEqual({
      opacity: 25,
      offset: { x: 10, y: 20 },
    });
    input.set(element.id, { opacity: 60 });
    expect(submit(input).get(element.id)).toEqual({ opacity: 60 });
    input.delete(element.id);
    input.set("future", { opacity: 60 });
    expect([...submit(input)]).toEqual([["future", { opacity: 60 }]]);
    input.clear();
    expect(submit(input).size).toBe(0);
    expect(rendering).toHaveBeenCalledTimes(4);
  });

  it("preserves a pending visual update when followed by an equivalent snapshot", async () => {
    const { element, rendering, onChange } = await setup();
    const input = new Map([[element.id, { opacity: 50 }]]);
    act(() => {
      h.app.api.setElementRenderOverrides(input);
      h.app.api.setElementRenderOverrides(new Map(input));
    });
    expect(rendering).toHaveBeenCalledTimes(1);
    expect(
      rendering.mock.lastCall![0].renderConfig.elementRenderOverrides?.get(
        element.id,
      ),
    ).toEqual({ opacity: 50 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["opacity", "translation", "unknown", "empty"])(
    "does not repaint for unrelated updates with a %s snapshot",
    async (kind) => {
      const { element, submit, rendering } = await setup();
      submit(
        new Map([
          [
            kind === "unknown" ? "unknown" : element.id,
            kind === "translation"
              ? { offset: { x: 10, y: 0 } }
              : kind === "empty"
              ? {}
              : { opacity: 0 },
          ],
        ]),
      );
      rendering.mockClear();
      act(() => h.app.setState({ cursorButton: "down" }));
      act(() => h.app.setState({ cursorButton: "up" }));
      expect(rendering).not.toHaveBeenCalled();
      act(() => h.app.api.updateScene({ appState: { scrollX: 10 } }));
      expect(rendering).toHaveBeenCalledTimes(1);
    },
  );

  it("repaints without changing elements, history, store or onChange", async () => {
    const { element, submit, onChange, rendering } = await setup();
    const elements = h.elements;
    const before = JSON.stringify(elements);
    const state = h.state;
    const cached = Element.elementWithCanvasCache.get(element);
    const commit = vi.spyOn(h.store, "commit");
    const subscriber = vi.fn();
    const unsubscribe = h.app.api.onChange(subscriber);
    for (let opacity = 0; opacity <= 100; opacity += 20) {
      submit(
        new Map([[element.id, { opacity, offset: { x: opacity, y: 0 } }]]),
      );
    }
    expect(rendering).toHaveBeenCalledTimes(6);
    expect(h.elements).toBe(elements);
    expect(JSON.stringify(h.elements)).toBe(before);
    expect(h.state).toBe(state);
    expect(cached).toBeDefined();
    expect(Element.elementWithCanvasCache.get(element)).toBe(cached);
    expect(commit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("still commits document changes batched with visual updates", async () => {
    const { element, onChange } = await setup();
    act(() => {
      h.app.api.setElementRenderOverrides(
        new Map([[element.id, { opacity: 0 }]]),
      );
      h.app.api.updateScene({ appState: { viewBackgroundColor: "#ff0000" } });
    });
    expect(onChange).toHaveBeenCalled();
    expect(h.state.viewBackgroundColor).toBe("#ff0000");
  });

  it("does not skip ordinary forceUpdate calls after a visual-only commit", async () => {
    const { element, submit, onChange } = await setup();
    submit(new Map([[element.id, { opacity: 0 }]]));
    submit(new Map([[element.id, { opacity: 0 }]]));
    expect(onChange).not.toHaveBeenCalled();
    act(() => h.app.forceUpdate());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves exported geometry and opacity unchanged", async () => {
    const { element, submit } = await setup();
    const exportScene = async () =>
      (await exportToSvg(h.app.api.getSceneElements(), h.state, null))
        .outerHTML;
    const before = await exportScene();
    submit(
      new Map([[element.id, { opacity: 0, offset: { x: 1000, y: 1000 } }]]),
    );
    expect(await exportScene()).toBe(before);
  });

  it("clears on reset and ignores submissions after unmount", async () => {
    const { element, submit, rendering, unmount } = await setup();
    submit(new Map([[element.id, { opacity: 0 }]]));
    act(() => h.app.api.resetScene());
    expect(
      rendering.mock.lastCall![0].renderConfig.elementRenderOverrides,
    ).toHaveLength(0);
    const api = h.app.api;
    unmount();
    rendering.mockClear();
    expect(() =>
      api.setElementRenderOverrides(new Map([[element.id, { opacity: 0 }]])),
    ).not.toThrow();
    expect(rendering).not.toHaveBeenCalled();
  });

  it("keeps frame-name editing on document geometry while the frame is translated", async () => {
    mockBoundingClientRect();
    const { onChange, submit } = await setup();
    await waitFor(() => expect(h.state.width).toBe(200));
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 20,
      y: 30,
      width: 80,
      height: 50,
    });
    API.setElements([frame]);
    API.updateElement(frame, { name: "  Draft  " });
    act(() => h.setState({ editingFrame: frame.id }));
    const query = (selector: string) =>
      GlobalTestState.renderResult.container.querySelector<HTMLElement>(
        selector,
      );
    const nameElement = await waitFor(() => {
      const element = query(".frame-name");
      expect(element?.querySelector("input")).not.toBe(null);
      return element!;
    });
    const documentLeft = nameElement.style.left;
    onChange.mockClear();

    // A render-only offset that puts the frame far off-screen must neither
    // end the edit (which trims and commits the name) nor move the editor.
    submit(new Map([[frame.id, { offset: { x: 10000, y: 0 } }]]));
    expect(h.state.editingFrame).toBe(frame.id);
    expect(API.getElement(frame).name).toBe("  Draft  ");
    expect(onChange).not.toHaveBeenCalled();
    expect(query(".frame-name input")).not.toBe(null);
    expect(query(".frame-name")!.style.left).toBe(documentLeft);

    // Back to being a decoration, the name follows the offset and is culled.
    act(() => h.setState({ editingFrame: null }));
    expect(query(".frame-name")).toBe(null);
  });

  it.each([
    { type: "frame", zoom: 1, editing: false },
    { type: "frame", zoom: 2, editing: false },
    { type: "frame", zoom: 2, editing: true },
    { type: "magicframe", zoom: 2, editing: false },
  ] as const)(
    "keeps $type title hit bounds in document coordinates at zoom $zoom (editing: $editing)",
    async ({ type, zoom, editing }) => {
      mockBoundingClientRect({
        width: 1200,
        height: 1000,
        x: 40,
        left: 40,
        y: 30,
        top: 30,
        right: 1240,
        bottom: 1030,
      });
      const { onChange, submit } = await setup();
      await waitFor(() => expect(h.state.width).toBe(1200));
      const frame = API.createElement({
        type,
        id: "frame",
        x: 200,
        y: 200,
        width: 200,
        height: 80,
      });
      API.setElements([frame]);
      API.updateElement(frame, { name: "Frame title" });
      act(() =>
        h.setState({
          zoom: { value: getNormalizedZoom(zoom) },
          scrollX: 25,
          scrollY: -30,
          editingFrame: editing ? frame.id : null,
        }),
      );
      const title = await waitFor(() => {
        const element =
          GlobalTestState.renderResult.container.querySelector<HTMLElement>(
            ".frame-name",
          );
        expect(element).not.toBe(null);
        return element!;
      });
      // JSDOM has no layout: measure the rendered CSS position, including
      // visual offsets, within the editor's viewport rectangle.
      const measure = vi
        .spyOn(title, "getBoundingClientRect")
        .mockImplementation(() => {
          const width = 60;
          const height = editing ? 32 : 20;
          const left = h.state.offsetLeft + parseFloat(title.style.left);
          const bottom =
            h.state.offsetTop + h.state.height - parseFloat(title.style.bottom);
          return {
            x: left,
            y: bottom - height,
            left,
            top: bottom - height,
            right: left + width,
            bottom,
            width,
            height,
            toJSON: () => ({}),
          };
        });
      const cache = h.app.frameNameBoundsCache;
      cache._cache.clear();
      const documentBounds = cache.get(frame)!;
      const point = {
        x: documentBounds.x + documentBounds.width / 2,
        y: documentBounds.y + documentBounds.height / 2,
      };
      expect(h.app.hitElement(point.x, point.y, frame, false)).toBe(true);
      cache._cache.clear();
      onChange.mockClear();
      const documentElements = JSON.stringify(h.elements);

      // First measurement happens with a translated title (unless editing).
      submit(new Map([[frame.id, { offset: { x: 120, y: 150 } }]]));
      const bounds = cache.get(frame);
      expect(bounds).toEqual(documentBounds);
      measure.mockClear();
      submit(new Map([[frame.id, { offset: { x: 140, y: 160 } }]]));
      expect(cache.get(frame)).toBe(bounds);
      submit(null);
      expect(cache.get(frame)).toBe(bounds);
      expect(h.app.hitElement(point.x, point.y, frame, false)).toBe(true);
      expect(h.app.hitElement(point.x + 120, point.y + 150, frame, false)).toBe(
        false,
      );
      expect(measure).not.toHaveBeenCalled();
      expect(JSON.stringify(h.elements)).toBe(documentElements);
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("keeps the offsets map identity while only opacities change", () => {
    const first = getElementRenderOffsets(
      new Map([
        ["a", { opacity: 10, offset: { x: 1, y: 2 } }],
        ["b", { opacity: 20 }],
      ]),
      new Map(),
    );
    expect([...first]).toEqual([["a", { x: 1, y: 2 }]]);
    expect(
      getElementRenderOffsets(
        new Map([
          ["a", { opacity: 99, offset: { x: 1, y: 2 } }],
          ["b", { opacity: 0 }],
          ["c", { opacity: 0 }],
        ]),
        first,
      ),
    ).toBe(first);
    expect(
      getElementRenderOffsets(
        new Map([["a", { offset: { x: 1, y: 3 } }]]),
        first,
      ),
    ).not.toBe(first);
    expect(getElementRenderOffsets(new Map(), first).size).toBe(0);
    expect(
      getElementRenderOffsets(
        new Map([["b", { offset: { x: 1, y: 2 } }]]),
        first,
      ),
    ).not.toBe(first);
  });

  it("does not populate a replacement offsets map during a fade", () => {
    const snapshot = (opacity: number): ElementRenderOverrides =>
      new Map(
        Array.from({ length: 1000 }, (_, index) => [
          `r${index}`,
          { opacity, offset: { x: index, y: -index } },
        ]),
      );
    const first = getElementRenderOffsets(snapshot(20), new Map());
    // Snapshot iteration order does not affect offsets or their identity.
    const fade = new Map([...snapshot(80)].reverse());
    const set = vi.spyOn(Map.prototype, "set");
    const next = getElementRenderOffsets(fade, first);
    const writes = set.mock.calls.length;
    set.mockRestore();

    expect(next).toBe(first);
    expect(writes).toBe(0);
  });

  it.each([
    [
      "a later offset changes",
      [
        ["a", { x: 1, y: 2 }],
        ["b", { x: 3, y: 5 }],
      ],
    ],
    [
      "an offset is appended after unchanged entries",
      [
        ["a", { x: 1, y: 2 }],
        ["b", { x: 3, y: 4 }],
        ["c", { x: 5, y: 6 }],
      ],
    ],
    ["an offset is removed", [["a", { x: 1, y: 2 }]]],
    [
      "an ID changes without changing the number of offsets",
      [
        ["a", { x: 1, y: 2 }],
        ["c", { x: 3, y: 4 }],
      ],
    ],
  ] as const)("replaces the offsets map when %s", (_, entries) => {
    const previous: ElementRenderOffsets = new Map([
      ["a", { x: 1, y: 2 }],
      ["b", { x: 3, y: 4 }],
    ]);
    const next = getElementRenderOffsets(
      new Map(entries.map(([id, offset]) => [id, { offset }])),
      previous,
    );
    expect(next).not.toBe(previous);
    expect([...next]).toEqual(entries);
    expect([...previous]).toEqual([
      ["a", { x: 1, y: 2 }],
      ["b", { x: 3, y: 4 }],
    ]);
  });
});

describe("render override geometry", () => {
  const setup = (elements: NonDeletedExcalidrawElement[]) => {
    const scene = new Element.Scene(elements, { skipValidation: true });
    const renderer = new Renderer(scene);
    const appState: AppState = {
      ...getDefaultAppState(),
      width: 500,
      height: 500,
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: 0,
      scrollY: 0,
    };
    const { elementsMap } = renderer.getRenderableElements({
      ...appState,
      selectedElements: [],
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 500;
    const context = canvas.getContext("2d")!;
    const renderConfig: StaticCanvasRenderConfig = {
      imageCache: new Map(),
      renderGrid: false,
      isExporting: false,
      canvasBackgroundColor: "#fff",
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: "light",
    };
    // What App hands the static canvas: document culling, adjusted for the
    // snapshot's offsets, whose identity is kept while they don't change.
    let offsets: ElementRenderOffsets = new Map();
    const visibleWith = (
      overrides: ElementRenderOverrides,
      state: AppState = appState,
      map: RenderableElementsMap = elementsMap,
    ) => {
      const { visibleElements } = renderer.getRenderableElements({
        ...state,
        selectedElements: scene.getSelectedElements(state),
      });
      offsets = getElementRenderOffsets(overrides, offsets);
      return offsets.size
        ? renderer.getVisibleElementsWithRenderOffsets(
            visibleElements,
            map,
            state,
            offsets,
          )
        : visibleElements;
    };
    const draw = (overrides: ElementRenderOverrides) =>
      StaticScene.renderStaticScene({
        canvas,
        rc: rough.canvas(canvas),
        scale: 1,
        elementsMap,
        allElementsMap: scene.getNonDeletedElementsMap(),
        visibleElements: visibleWith(overrides),
        appState,
        renderConfig: {
          ...renderConfig,
          elementRenderOverrides: overrides,
        },
      });
    return {
      scene,
      renderer,
      appState,
      elementsMap,
      context,
      draw,
      visibleWith,
      renderConfig,
    };
  };

  it("culls at visual coordinates while preserving interaction geometry", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 600,
      y: 100,
      width: 50,
      height: 50,
    });
    const { renderer, appState, visibleWith } = setup([rect]);
    const overrides = new Map([[rect.id, { offset: { x: -300, y: 0 } }]]);
    expect(visibleWith(overrides)).toContain(rect);
    expect(
      renderer.getRenderableElements({ ...appState, selectedElements: [] })
        .visibleElements,
    ).not.toContain(rect);
    expect(rect.x).toBe(600);
  });

  it("updates cached visibility for new overrides, viewport bounds and scene elements", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "a",
      x: 600,
      y: 100,
      width: 50,
      height: 50,
    });
    const { renderer, appState, scene, visibleWith } = setup([rect]);
    const overrides = new Map([[rect.id, { offset: { x: -300, y: 0 } }]]);
    const visible = visibleWith(overrides);
    expect(visible).toContain(rect);
    expect(visibleWith(overrides, { ...appState, cursorButton: "down" })).toBe(
      visible,
    );
    // a new snapshot with the same offsets keeps the result too
    expect(
      visibleWith(
        new Map([[rect.id, { opacity: 50, offset: { x: -300, y: 0 } }]]),
      ),
    ).toBe(visible);
    expect(visibleWith(overrides, { ...appState, width: 100 })).not.toContain(
      rect,
    );
    expect(
      visibleWith(overrides, { ...appState, scrollX: -600 }),
    ).not.toContain(rect);
    expect(visibleWith(new Map())).not.toContain(rect);

    const moved = { ...rect, x: 1200 };
    scene.replaceAllElements([moved], { skipValidation: true });
    const changed = renderer.getRenderableElements({
      ...appState,
      selectedElements: [],
    });
    expect(visibleWith(overrides, appState, changed.elementsMap)).not.toContain(
      moved,
    );
  });

  it("reuses the document-visible set for opacity-only snapshots without viewport geometry", () => {
    const rects = Array.from({ length: 20 }, (_, index) =>
      API.createElement({
        type: "rectangle",
        id: `r${index}`,
        x: index * 30,
        y: 10,
        width: 20,
        height: 20,
      }),
    );
    const { renderer, appState, visibleWith } = setup(rects);
    const documentVisible = renderer.getRenderableElements({
      ...appState,
      selectedElements: [],
    }).visibleElements;
    const inViewport = vi.spyOn(Element, "isElementInViewport");

    expect(visibleWith(new Map([[rects[3].id, { opacity: 50 }]]))).toBe(
      documentVisible,
    );
    expect(visibleWith(new Map([[rects[3].id, { opacity: 51 }]]))).toBe(
      documentVisible,
    );
    expect(inViewport).not.toHaveBeenCalled();

    // translating one element checks that element only, not the scene
    const moving = visibleWith(
      new Map([[rects[3].id, { opacity: 50, offset: { x: 5, y: 0 } }]]),
    );
    expect(moving).toBe(documentVisible);
    expect(inViewport).toHaveBeenCalledTimes(1);
    expect(inViewport.mock.calls[0][0]).toBe(rects[3]);
    expect(
      visibleWith(
        new Map([[rects[3].id, { opacity: 50, offset: { x: 5000, y: 0 } }]]),
      ),
    ).toEqual(documentVisible.filter((element) => element !== rects[3]));
    expect(inViewport).toHaveBeenCalledTimes(2);
  });

  it("keeps frame-drag ordering responsive to selection and drag-state changes", () => {
    // `a` is off-screen in the document and only visible through its offset,
    // so the visible set is rebuilt in scene order on every change here.
    const a = API.createElement({ type: "rectangle", id: "a", x: 600, y: 10 });
    const b = API.createElement({ type: "rectangle", id: "b", x: 10, y: 10 });
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      width: 300,
      height: 300,
    });
    const child = API.createElement({
      type: "rectangle",
      id: "child",
      frameId: frame.id,
      x: 20,
      y: 20,
    });
    const { appState, visibleWith } = setup([a, b, frame, child]);
    const overrides = new Map([[a.id, { offset: { x: -590, y: 0 } }]]);
    const ids = (state: AppState) =>
      visibleWith(overrides, state).map((element) => element.id);
    const selected: AppState = {
      ...appState,
      selectedElementIds: { [a.id]: true },
      frameToHighlight: frame,
    };
    expect(ids(selected)).toEqual(["a", "b", "frame", "child"]);
    expect(ids({ ...selected, selectedElementsAreBeingDragged: true })).toEqual(
      ["b", "frame", "child", "a"],
    );
    expect(
      ids({
        ...selected,
        selectedElementsAreBeingDragged: true,
        selectedElementIds: { [b.id]: true },
      }),
    ).toEqual(["a", "frame", "child", "b"]);
    expect(ids(selected)).toEqual(["a", "b", "frame", "child"]);
  });

  it("drops the frame-drag reordering when the anchoring frame is translated away", () => {
    const a = API.createElement({ type: "rectangle", id: "a", x: 10, y: 10 });
    const b = API.createElement({ type: "rectangle", id: "b", x: 10, y: 10 });
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    const { appState, visibleWith } = setup([a, b, frame]);
    const dragging: AppState = {
      ...appState,
      selectedElementIds: { [a.id]: true },
      frameToHighlight: frame,
      selectedElementsAreBeingDragged: true,
    };
    const ids = (overrides: ElementRenderOverrides) =>
      visibleWith(overrides, dragging).map((element) => element.id);
    expect(ids(new Map())).toEqual(["b", "a", "frame"]);
    // the frame leaves the view: back to plain scene order, like a full
    // recalculation would produce
    expect(ids(new Map([[frame.id, { offset: { x: 10000, y: 0 } }]]))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(new Map([[frame.id, { offset: { x: 0, y: 0 } }]]))).toEqual([
      "b",
      "a",
      "frame",
    ]);
  });

  it.each(["a", "b", "c"])(
    "preserves scene order as %s is translated into and out of view",
    (id) => {
      const sceneIds = ["a", "b", "c"];
      const { visibleWith } = setup(
        sceneIds.map((elementId) =>
          API.createElement({
            type: "rectangle",
            id: elementId,
            x: elementId === id ? 600 : 10,
            y: 10,
          }),
        ),
      );
      const ids = (offsetX: number) =>
        visibleWith(new Map([[id, { offset: { x: offsetX, y: 0 } }]])).map(
          (element) => element.id,
        );
      expect(ids(-590)).toEqual(sceneIds);
      expect(ids(-580)).toEqual(sceneIds);
      expect(ids(-570)).toEqual(sceneIds);
      expect(ids(0)).toEqual(sceneIds.filter((elementId) => elementId !== id));
    },
  );

  it("preserves scene order when elements enter and leave in the same update", () => {
    const a = API.createElement({ type: "rectangle", id: "a", x: 600, y: 10 });
    const b = API.createElement({ type: "rectangle", id: "b", x: 10, y: 10 });
    const c = API.createElement({ type: "rectangle", id: "c", x: 600, y: 60 });
    const d = API.createElement({ type: "rectangle", id: "d", x: 10, y: 60 });
    const { visibleWith } = setup([a, b, c, d]);
    expect(
      visibleWith(
        new Map([
          [c.id, { offset: { x: -590, y: 0 } }],
          [b.id, { offset: { x: 1000, y: 0 } }],
          [a.id, { offset: { x: -590, y: 0 } }],
        ]),
      ),
    ).toEqual([a, c, d]);
    expect(visibleWith(new Map())).toEqual([b, d]);
  });

  it("does not rebuild the visible set for a translated arrow whose label is off-screen", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: -1000,
      y: 100,
      width: 1100,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1100, 0)],
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      x: -500,
      y: 90,
      width: 50,
      text: "label",
      containerId: arrow.id,
    });
    const { renderer, appState, elementsMap, visibleWith } = setup([
      arrow,
      label,
    ]);
    const documentVisible = renderer.getRenderableElements({
      ...appState,
      selectedElements: [],
    }).visibleElements;
    expect(documentVisible).toEqual([arrow]);
    const walk = vi.spyOn(elementsMap, "values");
    for (const x of [10, 20, 30]) {
      expect(visibleWith(new Map([[arrow.id, { offset: { x, y: 0 } }]]))).toBe(
        documentVisible,
      );
    }
    expect(walk).not.toHaveBeenCalled();
  });

  it.each(["rectangle", "arrow"] as const)(
    "culls a %s by its container offset; its label needs no entry of its own",
    (type) => {
      const container = API.createElement({
        type,
        id: "a",
        x: 900,
        y: 100,
        width: 100,
        points:
          type === "arrow"
            ? [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)]
            : undefined,
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        x: 750,
        y: 110,
        width: 400,
        text: "label",
        containerId: container.id,
      });
      const { renderer, appState, visibleWith } = setup([container, label]);
      const visible = visibleWith;
      expect(visible(new Map())).toEqual([]);
      // The container comes into view through its offset; the label is drawn
      // with it, so its own (document, off-screen) entry stays out and any
      // offset targeting it directly is ignored.
      expect(
        visible(new Map([[container.id, { offset: { x: -500, y: 0 } }]])),
      ).toEqual([container]);
      expect(
        visible(
          new Map([
            [container.id, { offset: { x: -500, y: 0 } }],
            [label.id, { offset: { x: 2000, y: 0 } }],
          ]),
        ),
      ).toEqual([container]);
      expect(
        visible(new Map([[label.id, { offset: { x: -800, y: 0 } }]])),
      ).toEqual([]);
      expect(
        visible(
          new Map([
            [container.id, { offset: { x: -2000, y: 0 } }],
            [label.id, { offset: { x: -800, y: 0 } }],
          ]),
        ),
      ).toEqual([]);
      expect(
        renderer.getRenderableElements({ ...appState, selectedElements: [] })
          .visibleElements,
      ).toEqual([]);
    },
  );

  it.each(["arrow", "rectangle", "ellipse", "diamond", "stickynote"] as const)(
    "moves a %s label with its container while keeping label opacity independent",
    (type) => {
      const frame = API.createElement({
        type: "frame",
        id: "frame",
        width: 500,
        height: 500,
        opacity: 50,
      });
      const container = API.createElement({
        type,
        id: "container",
        x: 50,
        y: 100,
        width: 200,
        height: 100,
        frameId: frame.id,
        points:
          type === "arrow"
            ? [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)]
            : undefined,
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        text: "Label",
        x: 100,
        y: 140,
        width: 50,
        height: 25,
        opacity: 70,
        containerId: container.id,
        frameId: frame.id,
      });
      const { context, draw } = setup([container, label, frame]);
      draw(new Map());
      const bitmap = Element.elementWithCanvasCache.get(label)!;
      expect(bitmap).toBeDefined();
      const original = JSON.stringify([container, label, frame]);
      const paints: { x: number; y: number; alpha: number }[] = [];
      const drawImage = vi.mocked(context.drawImage).getMockImplementation()!;
      vi.spyOn(context, "drawImage").mockImplementation((...args) => {
        const [source, x, y] = args;
        if (source === bitmap.canvas) {
          const t = context.getTransform();
          paints.push({
            x: t.a * x + t.c * y + t.e,
            y: t.b * x + t.d * y + t.f,
            alpha: context.globalAlpha,
          });
        }
        drawImage.call(context, ...args);
      });
      const offset = { x: 20, y: 10 };
      draw(new Map());
      draw(new Map([[container.id, { offset }]]));
      draw(
        new Map([
          [container.id, { offset }],
          [label.id, { offset }],
        ]),
      );
      draw(
        new Map([
          [container.id, { offset, opacity: 10 }],
          [label.id, { offset: { x: 1000, y: -1000 }, opacity: 40 }],
        ]),
      );
      draw(new Map([[label.id, { offset: { x: 1000, y: -1000 } }]]));
      draw(new Map());
      expect(paints).toHaveLength(6);
      const [baseline] = paints;
      expect(baseline.alpha).toBe(0.35);
      const translated = {
        x: baseline.x + offset.x,
        y: baseline.y + offset.y,
        alpha: baseline.alpha,
      };
      expect(paints.slice(1)).toEqual([
        translated,
        translated,
        { ...translated, alpha: 0.2 },
        baseline,
        baseline,
      ]);
      expect(Element.elementWithCanvasCache.get(label)).toBe(bitmap);
      expect(JSON.stringify([container, label, frame])).toBe(original);
    },
  );

  it("keeps offsets on unbound text independent", () => {
    const label = API.createElement({
      type: "text",
      x: 600,
      y: 100,
      text: "Label",
    });
    const { elementsMap, renderConfig, visibleWith } = setup([label]);
    const overrides = new Map([[label.id, { offset: { x: -400, y: 10 } }]]);
    expect(
      Element.resolveElementRenderState(label, elementsMap, {
        ...renderConfig,
        elementRenderOverrides: overrides,
      }).offset,
    ).toEqual({ x: -400, y: 10 });
    expect(visibleWith(overrides)).toContain(label);
  });

  it("clips a translated child against the translated frame boundary", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 120,
      y: 120,
      width: 50,
      height: 50,
      frameId: frame.id,
    });
    const { draw, context } = setup([rect, frame]);
    const clip = vi.spyOn(context, "clip");
    const translate = vi.spyOn(context, "translate");
    draw(
      new Map([
        [rect.id, { offset: { x: -60, y: 0 } }],
        [frame.id, { offset: { x: 10, y: 0 } }],
      ]),
    );
    expect(clip).toHaveBeenCalled();
    expect(translate).toHaveBeenCalledWith(110, 100);
  });

  it("multiplies overridden frame and child opacities", () => {
    const frame = API.createElement({ type: "frame", id: "frame" });
    const rect = API.createElement({ type: "rectangle", frameId: frame.id });
    expect(
      Element.resolveElementRenderState(
        rect,
        new Map<string, NonDeletedExcalidrawElement>([
          [frame.id, frame],
          [rect.id, rect],
        ]),
        {
          elementRenderOverrides: new Map([
            [frame.id, { opacity: 50 }],
            [rect.id, { opacity: 50 }],
          ]),
          elementsPendingErasure: new Set(),
          pendingFlowchartNodes: null,
        },
      ).opacity,
    ).toBe(0.25);
  });

  it("gives a synthetic embed label its owner's overrides and frame", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      width: 500,
      height: 500,
    });
    const embed = API.createElement({
      type: "embeddable",
      id: "embed",
      width: 200,
      height: 100,
      frameId: frame.id,
    });
    const { draw } = setup([embed, frame]);
    const renderElement = vi.spyOn(Element, "renderElement");
    draw(new Map([[embed.id, { opacity: 0, offset: { x: 20, y: 0 } }]]));
    const label = renderElement.mock.calls.find(
      ([element]) => element.type === "text",
    )?.[0];
    expect(label).toMatchObject({ id: embed.id, frameId: frame.id });
  });

  it.each([
    [0, 80],
    [80, 0],
    [30, 80],
    [80, 80],
  ])(
    "keeps the label gap with its arrow (arrow %s, ignored label %s)",
    (arrowX, labelX) => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 50,
        y: 100,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(300, 0)],
        boundElements: [{ id: "label", type: "text" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        containerId: arrow.id,
        text: "Label",
        width: 50,
        height: 25,
      });
      const { context, draw } = setup([arrow, label]);
      const holes: number[] = [];
      const rect = vi.mocked(context.rect).getMockImplementation()!;
      vi.spyOn(context, "rect").mockImplementation((x, y, width, height) => {
        if (width === label.width + BOUND_TEXT_PADDING * 2) {
          const transform = context.getTransform();
          holes.push(transform.a * x + transform.c * y + transform.e);
        }
        rect.call(context, x, y, width, height);
      });
      draw(new Map());
      draw(
        new Map([
          [arrow.id, { offset: { x: arrowX, y: 0 } }],
          [label.id, { offset: { x: labelX, y: 0 } }],
        ]),
      );
      expect(holes).toHaveLength(2);
      expect(holes[1] - holes[0]).toBeCloseTo(arrowX, 8);
    },
  );

  it("reuses original arrow shapes and bitmaps when rendering translated links", () => {
    const arrow = {
      ...API.createElement({
        type: "arrow",
        x: 50,
        y: 100,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
      }),
      link: "https://example.com",
    };
    const { draw } = setup([arrow]);
    draw(new Map());
    const bitmap = Element.elementWithCanvasCache.get(arrow);
    const shape = Element.ShapeCache.get(arrow, null);
    const generateShape = vi.spyOn(Element.ShapeCache, "generateElementShape");
    for (const x of [10, 20, 0]) {
      draw(new Map([[arrow.id, { offset: { x, y: 0 }, opacity: 40 }]]));
    }
    expect(bitmap).toBeDefined();
    expect(shape).toBeDefined();
    expect(Element.elementWithCanvasCache.get(arrow)).toBe(bitmap);
    expect(Element.ShapeCache.get(arrow, null)).toBe(shape);
    expect(generateShape).toHaveBeenCalled();
    expect(
      generateShape.mock.calls.every(([element]) => element === arrow),
    ).toBe(true);
  });

  it("preserves frame, erasure and selection alpha without leaking it to siblings or links", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      width: 400,
      height: 400,
    });
    const child = {
      ...API.createElement({
        type: "rectangle",
        x: 50,
        y: 50,
        frameId: frame.id,
      }),
      link: "https://example.com",
    };
    const sibling = API.createElement({ type: "rectangle", x: 200, y: 200 });
    const { context, draw, appState, renderConfig } = setup([
      child,
      frame,
      sibling,
    ]);
    appState.openDialog = {
      name: "elementLinkSelector",
      sourceElementId: sibling.id,
    };
    appState.selectedElementIds = { [sibling.id]: true };
    renderConfig.elementsPendingErasure.add(child.id);
    const alphas: number[] = [];
    const drawImage = vi.mocked(context.drawImage).getMockImplementation()!;
    vi.spyOn(context, "drawImage").mockImplementation((...args) => {
      alphas.push(context.globalAlpha);
      drawImage.call(context, ...args);
    });
    draw(
      new Map([
        [child.id, { opacity: 50 }],
        [frame.id, { opacity: 50 }],
      ]),
    );
    const erasedAlpha = (0.25 * ELEMENT_READY_TO_ERASE_OPACITY) / 100;
    expect(alphas).toEqual([
      erasedAlpha * DEFAULT_REDUCED_GLOBAL_ALPHA,
      erasedAlpha,
      1,
    ]);
    expect(context.globalAlpha).toBe(1);
  });

  it("keeps the uncropped preview at document coordinates while translating the image", () => {
    const image = {
      ...API.createElement({
        type: "image",
        x: 100,
        y: 100,
        width: 100,
        height: 60,
      }),
      crop: {
        x: 10,
        y: 5,
        width: 50,
        height: 30,
        naturalWidth: 100,
        naturalHeight: 60,
      },
    };
    const { context, draw, appState } = setup([image]);
    appState.croppingElementId = image.id;
    const paints: { x: number; y: number; alpha: number }[] = [];
    const drawImage = vi.mocked(context.drawImage).getMockImplementation()!;
    vi.spyOn(context, "drawImage").mockImplementation((...args) => {
      const [, x, y] = args;
      const t = context.getTransform();
      paints.push({
        x: t.a * x + t.c * y + t.e,
        y: t.b * x + t.d * y + t.f,
        alpha: context.globalAlpha,
      });
      drawImage.call(context, ...args);
    });
    draw(new Map());
    draw(new Map([[image.id, { offset: { x: 80, y: 40 }, opacity: 25 }]]));
    expect(paints).toHaveLength(4);
    expect(paints[2]).toEqual(paints[0]);
    expect(paints[2].alpha).toBe(0.1);
    expect(paints[3]).toEqual({
      x: paints[1].x + 80,
      y: paints[1].y + 40,
      alpha: 0.25,
    });
  });
});
