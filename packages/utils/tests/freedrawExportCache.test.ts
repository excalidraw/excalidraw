import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { mutateElement } from "@excalidraw/element";
import * as perfectFreehand from "@excalidraw/element/perfectFreehand";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { vi } from "vitest";

import type {
  ExcalidrawFreeDrawElement,
  NonDeleted,
} from "@excalidraw/element/types";

import * as utils from "../src";

const getStrokeSpy = vi.spyOn(perfectFreehand, "getStroke");

const stroke = () =>
  API.createElement({
    type: "freedraw",
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(20, 10),
      pointFrom<LocalPoint>(40, 0),
    ],
  }) as NonDeleted<ExcalidrawFreeDrawElement>;

const exportTile = (elements: NonDeleted<ExcalidrawFreeDrawElement>[]) =>
  utils.exportToCanvas({ elements, files: null, restoreElements: false });

describe("freedraw export", () => {
  beforeEach(() => {
    getStrokeSpy.mockClear();
  });

  it("traces an unchanged stroke once across exports", async () => {
    const element = stroke();
    await exportTile([element]);
    await exportTile([element]);
    expect(getStrokeSpy).toHaveBeenCalledTimes(1);
  });

  it("traces the stroke again once its version changes", async () => {
    const element = stroke();
    await exportTile([element]);
    mutateElement(element, new Map(), {
      points: [...element.points, pointFrom<LocalPoint>(60, 10)],
    });
    await exportTile([element]);
    expect(getStrokeSpy).toHaveBeenCalledTimes(2);
  });
});
