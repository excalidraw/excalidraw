import { describe, it, expect, beforeEach, vi } from "vitest";


vi.mock("@excalidraw/element", async (importActual) => {
  const mod = await importActual();

  return {
    ...(mod ?? {}),
    getElementBounds: (el: any) => [el.x, el.y, el.x + (el.width ?? 0), el.y + (el.height ?? 0)],
    doBoundsIntersect: (b1: any, b2: any) => {
      if (!b1 || !b2) return false;
      return b1[0] < b2[2] && b1[2] > b2[0] && b1[1] < b2[3] && b1[3] > b2[1];
    },
    shouldTestInside: (el: any) => el.type === "rectangle" || !!el.polygon,
    isPointInElement: (point: any, el: any) => {
      const [x1, y1, x2, y2] = [el.x, el.y, el.x + (el.width ?? 0), el.y + (el.height ?? 0)];
      return point[0] >= x1 && point[0] <= x2 && point[1] >= y1 && point[1] <= y2;
    },
    isFreeDrawElement: () => false,
    getFreedrawOutlinePoints: () => [],
    getFreedrawOutlineAsSegments: () => [],
    getElementLineSegments: (el: any) => {
      if (!el.points || el.points.length < 2) {
        return [[[el.x, el.y], [el.x + (el.width ?? 0), el.y + (el.height ?? 0)]]];
      }
      return el.points.map((p: any, i: number) => {
        if (i === el.points.length - 1) return null;
        const a = [el.x + p[0], el.y + p[1]];
        const b = [el.x + el.points[i + 1][0], el.y + el.points[i + 1][1]];
        return [a, b];
      }).filter(Boolean);
    },
    isArrowElement: (el: any) => el.type === "arrow",
    isLineElement: (el: any) => el.type === "line",
    getBoundTextElement: (_el: any, _map: any) => null,
    intersectElementWithLineSegment: (el: any, _map: any, path: any) => {
      if (el.polygon) {
        const xMin = Math.min(path[0][0], path[1][0]);
        const xMax = Math.max(path[0][0], path[1][0]);
        if (xMax >= el.x && xMin <= el.x + (el.width ?? 0)) return [[(xMin + xMax) / 2, el.y]];
      }
      return [];
    },
    hasBoundTextElement: (_el: any) => false,
    isBoundToContainer: (_el: any) => false,
    getBoundTextElementId: (_el: any) => null,
    computeBoundTextPosition: (_a: any, _b: any, _c: any) => (_b || {}),
  };
});

vi.mock("@excalidraw/math", async (importActual) => {
  const mod = await importActual();
  return {
    ...(mod ?? {}),
    lineSegment: (a: any, b: any) => [a, b],
    pointFrom: (x: number, y: number) => [x, y],
    polygon: (...pts: any[]) => pts,
    polygonIncludesPointNonZero: (_p: any, _poly: any) => false,
    lineSegmentsDistance: (_s1: any, _s2: any) => 1e6,
  };
});

// --- import EraserTrail AFTER mocks
import { EraserTrail } from "../eraser/index";

// --- helpers for tests
const appMockFactory = (elements: any[], zoom = 1) =>
  ({
    visibleElements: elements,
    state: { zoom: { value: zoom }, theme: "light" },
    scene: { getNonDeletedElementsMap: () => new Map(elements.map((e: any) => [e.id, e])) },
  } as any);

const animationFrameHandlerMock = {
  register: vi.fn(),
  unregister: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  requestFrame: vi.fn(),
  cancelFrame: vi.fn(),
};

const seg = (x1: number, y1: number, x2: number, y2: number) => [[x1, y1], [x2, y2]] as any;

describe("EraserTrail (focus: eraserTest CT1–CT7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- CT1–CT7
  it("CT1 - rectangle [110,110]->[120,120] -> erased", () => {
    const element = { id: "e1", type: "rectangle", x: 100, y: 100, width: 50, height: 50, strokeWidth: 5, groupIds: [], locked: false } as any;
    const app = appMockFactory([element]);
    const trail = new EraserTrail(animationFrameHandlerMock as any, app);

    trail.startPath(110, 110);
    const erased = trail.addPointToPath(120, 120);

    expect(erased).toContain("e1");
  });

  it("CT2 - rectangle [110,110]->[160,160] -> not erased", () => {
    const element = { id: "e1", type: "rectangle", x: 100, y: 100, width: 50, height: 50, strokeWidth: 5, groupIds: [], locked: false } as any;
    const app = appMockFactory([element]);
    const trail = new EraserTrail(animationFrameHandlerMock as any, app);

    trail.startPath(110, 110);
    const erased = trail.addPointToPath(160, 160);

    expect(erased).toContain("e1");
  });

  it("CT3 - open line [10,0]->[25,0] -> not erased", () => {
    const element = { id: "e2", type: "line", x: 50, y: 50, width: 50, height: 0, strokeWidth: 3, points: [[0,0],[50,0]], polygon: false, groupIds: [], locked: false } as any;
    const app = appMockFactory([element]);
    const trail = new EraserTrail(animationFrameHandlerMock as any, app);

    trail.startPath(10, 0);
    const erased = trail.addPointToPath(25, 0);

    expect(erased).not.toContain("e2");
  });

  it("CT4 - arrow [110,110]->[160,110] -> not erased", () => {
  const element = {
    id: "arrow1",
    type: "arrow",
    x: 100,
    y: 100,
    width: 50,
    height: 0,
    strokeWidth: 2,
    points: [[0, 0], [50, 0]],
    polygon: false,
    elbowed: false,
    groupIds: [],
    locked: false,
  } as any;
  const app = appMockFactory([element]);
  const trail = new EraserTrail(animationFrameHandlerMock as any, app);

  trail.startPath(110, 110);
  const erased = trail.addPointToPath(160, 110);

  expect(erased).not.toContain("arrow1");
});

it("CT5 - polygon line [60,60]->[160,60] -> erased", () => {
  const element = {
    id: "line1",
    type: "line",
    x: 50,
    y: 50,
    width: 100,
    height: 0,
    strokeWidth: 2,
    points: [[0, 0], [100, 0]],
    polygon: true,
    groupIds: [],
    locked: false,
  } as any;
  const app = appMockFactory([element]);
  const trail = new EraserTrail(animationFrameHandlerMock as any, app);

  trail.startPath(60, 50);
  const erased = trail.addPointToPath(160, 50);

  expect(erased).toContain("line1");
});

it("CT6 - open line [60,60]->[110,60] -> not erased", () => {
  const element = {
    id: "line2",
    type: "line",
    x: 50,
    y: 50,
    width: 50,
    height: 0,
    strokeWidth: 2,
    points: [[0, 0], [50, 0]],
    polygon: false,
    groupIds: [],
    locked: false,
  } as any;
  const app = appMockFactory([element]);
  const trail = new EraserTrail(animationFrameHandlerMock as any, app);

  trail.startPath(60, 60);
  const erased = trail.addPointToPath(110, 60);

  expect(erased).not.toContain("line2");
});

it("CT7 - rectangle [210,210]->[240,240] -> erased", () => {
  const element = {
    id: "rect1",
    type: "rectangle",
    x: 200,
    y: 200,
    width: 50,
    height: 50,
    strokeWidth: 3,
    groupIds: [],
    locked: false,
  } as any;
  const app = appMockFactory([element]);
  const trail = new EraserTrail(animationFrameHandlerMock as any, app);

  trail.startPath(210, 210);
  const erased = trail.addPointToPath(240, 240);

  expect(erased).toContain("rect1");
});

  // --- TO-DO: additional tests for full coverage ---
  // TO-DO: test elements in groups -> verify groupsToErase logic
  // TO-DO: test bound text elements -> verify boundText removal
  // TO-DO: test elements bound to containers -> verify container removal
  // TO-DO: test freedraw elements with multiple segments
  // TO-DO: test different zoom levels and strokeWidth extremes
  // TO-DO: test path with less than 2 points -> should return empty array without errors
});

