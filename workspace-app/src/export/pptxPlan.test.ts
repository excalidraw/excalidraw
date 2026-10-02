import { describe, expect, it } from "vitest";

import {
  deckSize,
  elementsForPage,
  fitPage,
  planElement,
  planPage,
  smoothPath,
  toHex,
} from "./pptxPlan";

import type { PageSpec, PlanContext } from "./pptxPlan";

const ctx: PlanContext = {
  origin: { x: 0, y: 0 },
  scale: 1,
  offset: { x: 0, y: 0 },
};
const base = {
  isDeleted: false,
  angle: 0,
  opacity: 100,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  strokeWidth: 2,
  strokeStyle: "solid",
  fillStyle: "solid",
  roundness: null,
};

describe("colours", () => {
  it("normalises hex/rgb forms and treats transparent as none", () => {
    expect(toHex("#abc")).toBe("AABBCC");
    expect(toHex("#1e1e1eff")).toBe("1E1E1E");
    expect(toHex("rgb(255, 0, 10)")).toBe("FF000A");
    expect(toHex("transparent")).toBeNull();
    expect(toHex(undefined)).toBeNull();
  });
});

describe("shapes", () => {
  it("maps rectangles 1px = 1/96in with fill, stroke and rotation", () => {
    const c = planElement(
      {
        ...base,
        type: "rectangle",
        x: 96,
        y: 192,
        width: 192,
        height: 96,
        backgroundColor: "#a5d8ff",
        angle: Math.PI / 2,
      },
      ctx,
    ) as any;
    expect(c).toMatchObject({
      kind: "shape",
      shape: "rect",
      x: 1,
      y: 2,
      w: 2,
      h: 1,
      rotate: 90,
    });
    expect(c.fill).toEqual({ color: "A5D8FF", transparency: 0 });
    expect(c.stroke).toMatchObject({
      color: "1E1E1E",
      widthPt: 1.5,
      dash: "solid",
    });
  });
  it("uses rounded rectangles for rounded elements, ellipse/diamond natively", () => {
    expect(
      planElement(
        {
          ...base,
          type: "rectangle",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          roundness: { type: 3 },
        },
        ctx,
      ),
    ).toMatchObject({ shape: "roundRect" });
    expect(
      planElement(
        { ...base, type: "ellipse", x: 0, y: 0, width: 10, height: 10 },
        ctx,
      ),
    ).toMatchObject({ shape: "ellipse" });
    expect(
      planElement(
        { ...base, type: "diamond", x: 0, y: 0, width: 10, height: 10 },
        ctx,
      ),
    ).toMatchObject({ shape: "diamond" });
  });
  it("converts opacity to transparency, dash styles, and lightens patterned fills", () => {
    const c = planElement(
      {
        ...base,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        opacity: 40,
        strokeStyle: "dotted",
        backgroundColor: "#ff0000",
        fillStyle: "hachure",
      },
      ctx,
    ) as any;
    expect(c.stroke).toMatchObject({ dash: "sysDot", transparency: 60 });
    expect(c.fill.transparency).toBe(60);
    const d = planElement(
      {
        ...base,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        backgroundColor: "#ff0000",
        fillStyle: "hachure",
      },
      ctx,
    ) as any;
    expect(d.fill.transparency).toBe(55);
  });
  it("skips deleted elements, frames and unsupported types", () => {
    expect(
      planElement(
        {
          ...base,
          type: "rectangle",
          isDeleted: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        ctx,
      ),
    ).toBeNull();
    expect(
      planElement(
        { ...base, type: "frame", x: 0, y: 0, width: 1, height: 1 },
        ctx,
      ),
    ).toBeNull();
    expect(
      planElement(
        { ...base, type: "embeddable", x: 0, y: 0, width: 1, height: 1 },
        ctx,
      ),
    ).toBeNull();
  });
});

describe("text", () => {
  const t = {
    ...base,
    type: "text",
    x: 96,
    y: 96,
    width: 192,
    height: 48,
    text: "Hello",
    fontSize: 32,
    fontFamily: 5,
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.25,
  };
  it("maps fonts, sizes (px -> pt), alignment and line spacing", () => {
    expect(planElement(t, ctx)).toMatchObject({
      kind: "text",
      fontFace: "Comic Sans MS",
      fontPt: 24,
      align: "center",
      valign: "middle",
      x: 1,
      y: 1,
      w: 2,
      h: 0.5,
    });
    expect((planElement(t, ctx) as any).lineSpacing).toBeCloseTo(1.0417, 3);
  });
  it("drops empty text", () => {
    expect(planElement({ ...t, text: "  \n " }, ctx)).toBeNull();
  });
});

describe("lines and arrows", () => {
  it("builds a polyline path relative to its bounding box, with arrowheads", () => {
    const c = planElement(
      {
        ...base,
        type: "arrow",
        x: 96,
        y: 96,
        width: 192,
        height: 96,
        points: [
          [0, 0],
          [192, 96],
        ],
        startArrowhead: null,
        endArrowhead: "triangle",
      },
      ctx,
    ) as any;
    expect(c).toMatchObject({
      kind: "path",
      x: 1,
      y: 1,
      w: 2,
      h: 1,
      endArrow: "triangle",
      beginArrow: "none",
    });
    expect(c.points).toEqual([
      { x: 0, y: 0, moveTo: true },
      { x: 2, y: 1 },
    ]);
    expect(c.fill.transparency).toBe(100);
  });
  it("handles negative directions (arrow drawn right-to-left / bottom-to-top)", () => {
    const c = planElement(
      {
        ...base,
        type: "arrow",
        x: 200,
        y: 200,
        width: 96,
        height: 96,
        points: [
          [0, 0],
          [-96, -96],
        ],
        endArrowhead: "arrow",
      },
      ctx,
    ) as any;
    expect(c.x).toBeCloseTo(104 / 96);
    expect(c.points).toEqual([
      { x: 1, y: 1, moveTo: true },
      { x: 0, y: 0 },
    ]);
  });
  it("uses cubic curves for rounded multi-point lines and closes polygons", () => {
    const pts = [
      [0, 0],
      [96, 96],
      [192, 0],
    ];
    const curved = planElement(
      {
        ...base,
        type: "line",
        x: 0,
        y: 0,
        width: 192,
        height: 96,
        points: pts,
        roundness: { type: 2 },
      },
      ctx,
    ) as any;
    expect(
      curved.points.slice(1).every((p: any) => p.curve?.type === "cubic"),
    ).toBe(true);
    const poly = planElement(
      {
        ...base,
        type: "line",
        x: 0,
        y: 0,
        width: 192,
        height: 96,
        points: pts,
        polygon: true,
        backgroundColor: "#00ff00",
      },
      ctx,
    ) as any;
    expect(poly.points[poly.points.length - 1]).toEqual({ close: true });
    expect(poly.fill.color).toBe("00FF00");
  });
  it("never produces zero-size boxes and thins out huge freehand strokes", () => {
    const flat = planElement(
      {
        ...base,
        type: "line",
        x: 0,
        y: 0,
        width: 96,
        height: 0,
        points: [
          [0, 0],
          [96, 0],
        ],
      },
      ctx,
    ) as any;
    expect(flat.h).toBeGreaterThan(0);
    const many = Array.from({ length: 2000 }, (_, i) => [
      i,
      Math.sin(i / 10) * 20,
    ]);
    const fd = planElement(
      {
        ...base,
        type: "freedraw",
        x: 0,
        y: 0,
        width: 2000,
        height: 40,
        points: many,
      },
      ctx,
    ) as any;
    expect(fd.points.length).toBeLessThanOrEqual(401);
  });
  it("smoothPath passes through every input point", () => {
    const sp = smoothPath([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]);
    expect(sp.map((p: any) => [p.x, p.y])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]);
  });
});

describe("images", () => {
  it("keeps file reference, flips, and crop info", () => {
    const c = planElement(
      {
        ...base,
        type: "image",
        x: 0,
        y: 0,
        width: 96,
        height: 96,
        fileId: "f1",
        scale: [-1, 1],
        crop: { x: 1 },
      },
      ctx,
    ) as any;
    expect(c).toMatchObject({
      kind: "image",
      fileId: "f1",
      flipH: true,
      flipV: false,
      crop: { x: 1 },
    });
  });
});

describe("pages", () => {
  const frameA: PageSpec = {
    name: "A",
    bounds: { x: 0, y: 0, w: 960, h: 540 },
    frameId: "fa",
  };
  const frameB: PageSpec = {
    name: "B",
    bounds: { x: 1000, y: 0, w: 480, h: 270 },
    frameId: "fb",
  };
  const els = [
    {
      ...base,
      id: "1",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      frameId: "fa",
    },
    {
      ...base,
      id: "2",
      type: "rectangle",
      x: 1100,
      y: 100,
      width: 50,
      height: 50,
      frameId: null,
    },
    {
      ...base,
      id: "3",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      frameId: "fb",
    },
    {
      ...base,
      id: "4",
      type: "rectangle",
      x: 5000,
      y: 5000,
      width: 50,
      height: 50,
      frameId: null,
    },
    { ...base, id: "f", type: "frame", x: 0, y: 0, width: 960, height: 540 },
  ];
  it("assigns elements by frame membership or geometry, never twice, never frames themselves", () => {
    expect(elementsForPage(els, frameA).map((e) => e.id)).toEqual(["1"]);
    expect(elementsForPage(els, frameB).map((e) => e.id)).toEqual(["2", "3"]);
  });
  it("uses one deck size and fits smaller frames uniformly, centred", () => {
    const deck = deckSize([frameA, frameB]);
    expect(deck).toEqual({ w: 960, h: 540 });
    const fit = fitPage(frameB, deck);
    expect(fit.scale).toBe(2);
    expect(fit.offset).toEqual({ x: 0, y: 0 });
    const wide = fitPage(
      { name: "w", bounds: { x: 0, y: 0, w: 960, h: 270 }, frameId: null },
      deck,
    );
    expect(wide.scale).toBe(1);
    expect(wide.offset.y).toBe(135);
  });
  it("scales element geometry into the slide", () => {
    const cmds = planPage(els, frameB, deckSize([frameA, frameB]));
    // element 2 at scene x=1100 is 100px into frame B, scaled 2x -> 200px -> 200/96 in
    expect((cmds[0] as any).x).toBeCloseTo(200 / 96);
    expect((cmds[0] as any).w).toBeCloseTo(100 / 96);
  });
});
