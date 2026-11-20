import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { Bounds } from "@excalidraw/common";
import type { LocalPoint } from "@excalidraw/math";

import { getElementBounds } from "../src/bounds";
import {
  bumpVersion,
  mutateElement,
  newElementWith,
} from "../src/mutateElement";
import { Scene } from "../src/Scene";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../src/types";

const rect = (x: number, y: number, width = 100, height = 100) =>
  API.createElement({ type: "rectangle", x, y, width, height });

const ids = (elements: readonly ExcalidrawElement[]) =>
  elements.map((element) => element.id);

/** the full scan the index replaces */
const bruteForce = (scene: Scene, [qx1, qy1, qx2, qy2]: Bounds) =>
  scene.getNonDeletedElements().filter((element) => {
    const [x1, y1, x2, y2] = getElementBounds(
      element,
      scene.getNonDeletedElementsMap(),
    );
    return qx1 <= x2 && qy1 <= y2 && qx2 >= x1 && qy2 >= y1;
  });

describe("Scene.getNonDeletedElementsInBounds", () => {
  it("returns intersecting elements in z-order", () => {
    const a = rect(0, 0);
    const b = rect(5000, 5000);
    const c = rect(50, 50);
    const scene = new Scene([a, b, c], { skipValidation: true });

    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 200, 200]))).toEqual([
      a.id,
      c.id,
    ]);
    // edges are inclusive, matching isElementInViewport
    expect(
      ids(scene.getNonDeletedElementsInBounds([100, 100, 120, 120])),
    ).toEqual([a.id, c.id]);
    expect(
      ids(scene.getNonDeletedElementsInBounds([4000, 4000, 4500, 4500])),
    ).toEqual([]);
  });

  it("follows in-place mutations that don't inform the scene", () => {
    const a = rect(0, 0);
    const b = rect(10_000, 0);
    const scene = new Scene([a, b], { skipValidation: true });
    // build the index before mutating
    scene.getNonDeletedElementsInBounds([0, 0, 1, 1]);

    // bare mutateElement, bypassing the scene entirely
    mutateElement(a, scene.getNonDeletedElementsMap(), { x: 20_000 });
    // scene mutation with informMutation: false
    scene.mutateElement(
      b,
      { x: 30_000, width: 5_000 },
      { informMutation: false, isDragging: false },
    );

    expect(
      ids(scene.getNonDeletedElementsInBounds([0, 0, 15_000, 100])),
    ).toEqual([]);
    expect(
      ids(scene.getNonDeletedElementsInBounds([20_000, 0, 20_050, 100])),
    ).toEqual([a.id]);
    expect(
      ids(scene.getNonDeletedElementsInBounds([34_000, 0, 34_050, 100])),
    ).toEqual([b.id]);
  });

  it("follows direct writes followed by bumpVersion", () => {
    const a = rect(0, 0);
    const scene = new Scene([a], { skipValidation: true });
    scene.getNonDeletedElementsInBounds([0, 0, 1, 1]);

    (a as { x: number }).x = 50_000;
    bumpVersion(a);

    expect(
      ids(scene.getNonDeletedElementsInBounds([50_000, 0, 50_050, 50])),
    ).toEqual([a.id]);
  });

  it("reconciles added, removed and replaced elements", () => {
    const a = rect(0, 0);
    const b = rect(200, 0);
    const scene = new Scene([a, b], { skipValidation: true });
    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 500, 100]))).toEqual([
      a.id,
      b.id,
    ]);

    const movedB = newElementWith(b, { x: 9_000 });
    const c = rect(300, 0);
    scene.replaceAllElements([movedB, c], { skipValidation: true });

    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 500, 100]))).toEqual([
      c.id,
    ]);
    expect(
      ids(scene.getNonDeletedElementsInBounds([9_000, 0, 9_100, 100])),
    ).toEqual([movedB.id]);

    // mutating the stale object no longer affects the index
    mutateElement(b, new Map(), { x: 300 });
    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 500, 100]))).toEqual([
      c.id,
    ]);

    const deletedC = newElementWith(c as ExcalidrawElement, {
      isDeleted: true,
    });
    scene.replaceAllElements([movedB, deletedC], {
      skipValidation: true,
    });
    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 500, 100]))).toEqual(
      [],
    );
  });

  it("restores z-order after reordering", () => {
    const a = rect(0, 0);
    const b = rect(10, 10);
    const scene = new Scene([a, b], { skipValidation: true });
    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 50, 50]))).toEqual([
      a.id,
      b.id,
    ]);
    scene.replaceAllElements([b, a], { skipValidation: true });
    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 50, 50]))).toEqual([
      b.id,
      a.id,
    ]);
  });

  it("handles oversized and non-finite elements without per-cell blowup", () => {
    const huge = rect(-1e12, -1e12, 2e12, 2e12);
    const infinite = rect(0, 0, Infinity, 100);
    const nan = rect(NaN, 0);
    const normal = rect(0, 0);
    const scene = new Scene([huge, infinite, nan, normal], {
      skipValidation: true,
    });

    expect(ids(scene.getNonDeletedElementsInBounds([0, 0, 10, 10]))).toEqual(
      ids(bruteForce(scene, [0, 0, 10, 10])),
    );
    expect(
      ids(
        scene.getNonDeletedElementsInBounds([5e11, 5e11, 5e11 + 1, 5e11 + 1]),
      ),
    ).toEqual([huge.id]);
  });

  it("re-indexes an arrow label when only the arrow moves", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 400,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
    });
    const label = API.createElement({
      type: "text",
      x: 175,
      y: -10,
      width: 50,
      height: 20,
      containerId: arrow.id,
    });
    mutateElement(arrow, new Map(), {
      boundElements: [{ type: "text", id: label.id }],
    });
    const scene = new Scene([arrow, label], { skipValidation: true });

    const labelArea: Bounds = [190, -5, 210, 5];
    expect(ids(scene.getNonDeletedElementsInBounds(labelArea))).toEqual(
      ids(bruteForce(scene, labelArea)),
    );

    // the label's own x/y don't change, its position derives from the arrow
    mutateElement(arrow, scene.getNonDeletedElementsMap(), { x: 20_000 });

    const movedLabelArea: Bounds = [20_190, -5, 20_210, 5];
    const result = scene.getNonDeletedElementsInBounds(movedLabelArea);
    expect(ids(result)).toEqual(ids(bruteForce(scene, movedLabelArea)));
    expect(ids(result)).toContain(label.id);
  });

  it("matches a full scan under random edits (fuzz)", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const coord = () => (random() - 0.5) * 40_000;
    const size = () => (random() < 0.05 ? random() * 60_000 : random() * 600);
    const create = () => rect(coord(), coord(), size(), size());

    let elements: ExcalidrawElement[] = Array.from({ length: 300 }, create);
    const scene = new Scene(elements, { skipValidation: true });

    for (let step = 0; step < 400; step++) {
      const roll = random();
      const live = scene.getNonDeletedElements();
      const target = live[Math.floor(random() * live.length)] as
        | NonDeletedExcalidrawElement
        | undefined;

      if (roll < 0.5 && target) {
        mutateElement(target, scene.getNonDeletedElementsMap(), {
          x: coord(),
          y: coord(),
          width: size(),
          height: size(),
        });
      } else if (roll < 0.6 && target) {
        scene.mutateElement(
          target,
          { angle: (random() * Math.PI) as any },
          { informMutation: random() < 0.5, isDragging: false },
        );
      } else if (roll < 0.7) {
        elements = [...scene.getElementsIncludingDeleted(), create()];
        scene.replaceAllElements(elements, { skipValidation: true });
      } else if (roll < 0.8 && target) {
        scene.replaceAllElements(
          scene
            .getElementsIncludingDeleted()
            .map((element) =>
              element === target
                ? newElementWith(element, { isDeleted: true })
                : element,
            ),
          { skipValidation: true },
        );
      } else if (roll < 0.85) {
        scene.replaceAllElements(
          [...scene.getElementsIncludingDeleted()].reverse(),
          { skipValidation: true },
        );
      }

      const x = coord();
      const y = coord();
      const query: Bounds = [x, y, x + random() * 8_000, y + random() * 8_000];
      expect(ids(scene.getNonDeletedElementsInBounds(query))).toEqual(
        ids(bruteForce(scene, query)),
      );
    }
  });
});
