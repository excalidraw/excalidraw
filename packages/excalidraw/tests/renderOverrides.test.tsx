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

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

import type {
  AppState,
  ElementRenderOverride,
  ElementRenderOverrides,
} from "../types";
import type { StaticCanvasRenderConfig } from "../scene/types";

const { h } = window;

afterEach(() => vi.restoreAllMocks());

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
      return rendering.mock.lastCall![0].renderConfig.elementRenderOverrides!;
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
    const draw = (overrides: ElementRenderOverrides) =>
      StaticScene.renderStaticScene({
        canvas,
        rc: rough.canvas(canvas),
        scale: 1,
        elementsMap,
        allElementsMap: scene.getNonDeletedElementsMap(),
        visibleElements: renderer.getVisibleElementsForRendering(
          elementsMap,
          appState,
          overrides,
        ),
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
    const { renderer, elementsMap, appState } = setup([rect]);
    const overrides = new Map([[rect.id, { offset: { x: -300, y: 0 } }]]);
    expect(
      renderer.getVisibleElementsForRendering(elementsMap, appState, overrides),
    ).toContain(rect);
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
    const { renderer, elementsMap, appState, scene } = setup([rect]);
    const overrides = new Map([[rect.id, { offset: { x: -300, y: 0 } }]]);
    const visible = renderer.getVisibleElementsForRendering(
      elementsMap,
      appState,
      overrides,
    );
    expect(visible).toContain(rect);
    expect(
      renderer.getVisibleElementsForRendering(
        elementsMap,
        { ...appState, cursorButton: "down" },
        overrides,
      ),
    ).toBe(visible);
    expect(
      renderer.getVisibleElementsForRendering(
        elementsMap,
        { ...appState, width: 100 },
        overrides,
      ),
    ).not.toContain(rect);
    expect(
      renderer.getVisibleElementsForRendering(
        elementsMap,
        { ...appState, scrollX: -600 },
        overrides,
      ),
    ).not.toContain(rect);
    expect(
      renderer.getVisibleElementsForRendering(elementsMap, appState, new Map()),
    ).not.toContain(rect);

    const moved = { ...rect, x: 1200 };
    scene.replaceAllElements([moved], { skipValidation: true });
    const changed = renderer.getRenderableElements({
      ...appState,
      selectedElements: [],
    });
    expect(
      renderer.getVisibleElementsForRendering(
        changed.elementsMap,
        appState,
        overrides,
      ),
    ).not.toContain(moved);
  });

  it("keeps frame-drag ordering responsive to selection and drag-state changes", () => {
    const a = API.createElement({ type: "rectangle", id: "a", x: 10, y: 10 });
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
    const { renderer, elementsMap, appState } = setup([a, b, frame, child]);
    const overrides = new Map([[a.id, { opacity: 50 }]]);
    const ids = (state: AppState) =>
      renderer
        .getVisibleElementsForRendering(elementsMap, state, overrides)
        .map((element) => element.id);
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

  it.each(["rectangle", "arrow"] as const)(
    "culls a %s and its label using the container offset",
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
      const { renderer, appState, elementsMap } = setup([container, label]);
      const visible = (overrides: ElementRenderOverrides) =>
        renderer.getVisibleElementsForRendering(
          elementsMap,
          appState,
          overrides,
        );
      expect(visible(new Map())).toEqual([]);
      // The translated label overlaps the viewport even though its container
      // remains offscreen. The container must be included to paint the label.
      expect(
        visible(new Map([[container.id, { offset: { x: -300, y: 0 } }]])),
      ).toEqual([container, label]);
      expect(
        visible(
          new Map([
            [container.id, { offset: { x: -300, y: 0 } }],
            [label.id, { offset: { x: 2000, y: 0 } }],
          ]),
        ),
      ).toEqual([container, label]);
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
    const { renderer, appState, elementsMap, renderConfig } = setup([label]);
    const overrides = new Map([[label.id, { offset: { x: -400, y: 10 } }]]);
    expect(
      Element.resolveElementRenderState(label, elementsMap, {
        ...renderConfig,
        elementRenderOverrides: overrides,
      }).offset,
    ).toEqual({ x: -400, y: 10 });
    expect(
      renderer.getVisibleElementsForRendering(elementsMap, appState, overrides),
    ).toContain(label);
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
