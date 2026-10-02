import { describe, expect, it } from "vitest";

import {
  blockHeight,
  buildWireframe,
  DEVICE_WIDTH,
} from "../src/diagram/wireframe";

const spec = {
  title: "Login",
  blocks: [
    { type: "header" as const, label: "Acme" },
    { type: "input" as const, label: "Email" },
    { type: "input" as const, label: "Password" },
    { type: "button" as const, label: "Sign in" },
    { type: "list" as const, items: ["a", "b"] },
    { type: "image" as const },
  ],
};

describe("buildWireframe", () => {
  const wf = buildWireframe(spec, {
    origin: { x: 100, y: 200 },
    idPrefix: "t",
  });

  it("creates a named frame at the origin sized for its content", () => {
    const frame = wf.elements[0];
    expect(frame).toMatchObject({
      type: "frame",
      name: "Login",
      x: 100,
      y: 200,
      width: DEVICE_WIDTH.mobile,
    });
    const stack =
      spec.blocks.reduce((h, b) => h + blockHeight(b) + 14, 16) + 16 - 14;
    expect(frame.height).toBe(stack);
  });

  it("puts every element inside the frame bounds and references it", () => {
    const frame = wf.elements[0];
    for (const el of wf.elements.slice(1)) {
      expect(el.frameId).toBe(frame.id);
      // bounding box in scene space (lines may run leftwards/upwards from their start point)
      const xs = el.points
        ? el.points.map((p: number[]) => el.x + p[0]!)
        : [el.x, el.x + el.width];
      const ys = el.points
        ? el.points.map((p: number[]) => el.y + p[1]!)
        : [el.y, el.y + el.height];
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(frame.x);
      expect(Math.max(...xs)).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(frame.y);
      expect(Math.max(...ys)).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
    }
  });

  it("stacks blocks top to bottom without overlap and uses unique ids", () => {
    const ids = wf.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rects = wf.elements.filter(
      (e) => e.type === "rectangle" && e.height >= 40 && e.width > 300,
    );
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.y).toBeGreaterThanOrEqual(
        rects[i - 1]!.y + rects[i - 1]!.height,
      );
    }
    expect(
      wf.elements.filter((e) => e.type === "text").map((e) => e.text),
    ).toEqual(
      expect.arrayContaining([
        "Acme",
        "Email",
        "Password",
        "Sign in",
        "a",
        "b",
      ]),
    );
  });

  it("supports other devices and caps the number of blocks", () => {
    expect(
      buildWireframe({ device: "desktop", blocks: [{ type: "hero" }] }).width,
    ).toBe(1200);
    const many = buildWireframe({
      blocks: Array.from({ length: 500 }, () => ({ type: "divider" as const })),
    });
    expect(many.elements.filter((e) => e.type === "line").length).toBe(60);
  });
});
