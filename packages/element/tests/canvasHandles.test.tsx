import { pointFrom } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { AppState } from "@excalidraw/excalidraw/types";
import type { Radians } from "@excalidraw/math";

import { LinearElementEditor } from "../src/linearElementEditor";
import { getTransformHandlesFromCoords } from "../src/transformHandles";

import type { PointerType } from "../src/types";

describe("canvas handle scale", () => {
  const bounds = [0, 0, 300, 200, 150, 100] as const;
  const pointers: PointerType[] = ["mouse", "pen", "touch"];

  it.each(
    pointers.flatMap((pointer) =>
      [0.5, 1, 2].map((zoom) => [pointer, zoom] as const),
    ),
  )(
    "keeps %s target centers fixed at %s zoom while covering the enlarged handle",
    (pointer, zoomValue) => {
      const zoom = { value: zoomValue as AppState["zoom"]["value"] };
      const before = getTransformHandlesFromCoords(
        [...bounds],
        0 as Radians,
        zoom,
        pointer,
      );
      const after = getTransformHandlesFromCoords(
        [...bounds],
        0 as Radians,
        zoom,
        pointer,
        {},
        undefined,
        undefined,
        2,
      );

      for (const name of ["nw", "ne", "sw", "se", "rotation"] as const) {
        const previous = before[name]!;
        const next = after[name]!;
        expect(next[0] + next[2] / 2).toBeCloseTo(
          previous[0] + previous[2] / 2,
        );
        expect(next[1] + next[3] / 2).toBeCloseTo(
          previous[1] + previous[3] / 2,
        );
        expect(next[2] * zoomValue).toBe(pointer === "touch" ? 28 : 16);
        expect(next[3] * zoomValue).toBe(pointer === "touch" ? 28 : 16);
      }
    },
  );

  it("omits side handles that would crowd enlarged corner handles", () => {
    const zoom = { value: 1 as AppState["zoom"]["value"] };
    const smallBounds = [0, 0, 60, 60, 30, 30] as const;
    expect(
      getTransformHandlesFromCoords(
        [...smallBounds],
        0 as Radians,
        zoom,
        "mouse",
      ).n,
    ).toBeDefined();
    expect(
      getTransformHandlesFromCoords(
        [...smallBounds],
        0 as Radians,
        zoom,
        "mouse",
        {},
        undefined,
        undefined,
        2,
      ).n,
    ).toBeUndefined();
  });

  it.each([0.5, 1, 2])(
    "accepts the enlarged point edge at %s zoom",
    (zoomValue) => {
      const line = API.createElement({
        type: "line",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        points: [pointFrom(0, 0), pointFrom(100, 0)],
      });
      const elements = new Map([[line.id, line]]);
      const zoom = { value: zoomValue as AppState["zoom"]["value"] };
      expect(
        LinearElementEditor.getPointIndexUnderCursor(
          line,
          elements,
          zoom,
          0,
          20 / zoomValue,
        ),
      ).toBe(-1);
      expect(
        LinearElementEditor.getPointIndexUnderCursor(
          line,
          elements,
          zoom,
          0,
          20 / zoomValue,
          2,
        ),
      ).toBe(0);
      expect(
        LinearElementEditor.getPointIndexUnderCursor(
          line,
          elements,
          zoom,
          0,
          22 / zoomValue,
          2,
        ),
      ).toBe(-1);
    },
  );

  it("chooses the nearest enlarged point while retaining the default overlap order", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 10,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(10, 0)],
    });
    const elements = new Map([[line.id, line]]);
    const zoom = { value: 1 as AppState["zoom"]["value"] };
    expect(
      LinearElementEditor.getPointIndexUnderCursor(line, elements, zoom, 1, 0),
    ).toBe(1);
    expect(
      LinearElementEditor.getPointIndexUnderCursor(
        line,
        elements,
        zoom,
        1,
        0,
        2,
      ),
    ).toBe(0);
    expect(
      LinearElementEditor.getPointIndexUnderCursor(
        line,
        elements,
        zoom,
        5,
        0,
        2,
      ),
    ).toBe(1);
  });
  it("does not let an elbow route point steal an enlarged endpoint target", () => {
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 0,
      width: 100,
      height: 10,
      points: [pointFrom(0, 0), pointFrom(0, 10), pointFrom(100, 10)],
    });
    const elements = new Map([[arrow.id, arrow]]);
    const zoom = { value: 1 as AppState["zoom"]["value"] };
    expect(
      LinearElementEditor.getPointIndexUnderCursor(
        arrow,
        elements,
        zoom,
        1,
        9,
        2,
      ),
    ).toBe(0);
  });
});
