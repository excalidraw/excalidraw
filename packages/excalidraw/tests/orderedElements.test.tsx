import { vi } from "vitest";

import {
  CaptureUpdateAction,
  validateFractionalIndices,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  FractionalIndex,
  NonRestoredExcalidrawElement,
} from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

// see https://github.com/excalidraw/excalidraw/issues/7941

const { h } = window;

/** mimics elements created by a host app, which are not ordered yet */
const createUnorderedElements = (
  indices: (FractionalIndex | null)[] = [null, null, null],
): NonRestoredExcalidrawElement[] =>
  indices.map((index, i) => ({
    ...API.createElement({ id: `el-${i}`, type: "rectangle", x: i * 100 }),
    index,
  }));

const expectOrderedElements = (
  elements: readonly ExcalidrawElement[],
  expectedIds: string[],
) => {
  expect(elements.map((element) => element.id)).toEqual(expectedIds);
  for (const element of elements) {
    expect(element.index).toEqual(expect.any(String));
  }
  expect(() =>
    validateFractionalIndices(elements, {
      shouldThrow: true,
      includeBoundTextValidation: true,
      ignoreLogs: true,
    }),
  ).not.toThrow();
};

describe("ordered elements at the editor boundaries", () => {
  describe("restoreElements", () => {
    it("accepts unordered elements and returns them ordered", () => {
      const restored = restoreElements(createUnorderedElements(), null);

      expectOrderedElements(restored, ["el-0", "el-1", "el-2"]);
    });

    it("keeps valid indices and only fills in the missing ones", () => {
      const restored = restoreElements(
        createUnorderedElements([
          "a0" as FractionalIndex,
          null,
          "a5" as FractionalIndex,
        ]),
        null,
      );

      expectOrderedElements(restored, ["el-0", "el-1", "el-2"]);
      expect(restored[0].index).toBe("a0");
      expect(restored[2].index).toBe("a5");
      expect(restored[1].index! > "a0" && restored[1].index! < "a5").toBe(true);
    });

    it("still accepts already ordered elements", () => {
      const ordered = restoreElements(createUnorderedElements(), null);

      expectOrderedElements(restoreElements(ordered, null), [
        "el-0",
        "el-1",
        "el-2",
      ]);
    });
  });

  describe("editor", () => {
    it("orders unordered elements passed through initialData", async () => {
      await render(
        <Excalidraw initialData={{ elements: createUnorderedElements() }} />,
      );

      expectOrderedElements(h.elements, ["el-0", "el-1", "el-2"]);
    });

    it("orders unordered elements passed through updateScene", async () => {
      await render(<Excalidraw />);

      API.updateScene({
        elements: createUnorderedElements(),
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      expectOrderedElements(h.elements, ["el-0", "el-1", "el-2"]);
    });

    it("captures unordered elements passed through updateScene into history as ordered", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      API.updateScene({
        elements: createUnorderedElements(),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      expect(API.getUndoStack()).toHaveLength(1);
      expectOrderedElements(h.elements, ["el-0", "el-1", "el-2"]);
    });

    it("emits ordered elements through onChange", async () => {
      const onChange = vi.fn();
      await render(<Excalidraw onChange={onChange} />);

      API.updateScene({
        elements: createUnorderedElements(),
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      await waitFor(() => {
        const elements: readonly ExcalidrawElement[] =
          onChange.mock.lastCall?.[0] ?? [];
        expectOrderedElements(elements, ["el-0", "el-1", "el-2"]);
      });
    });

    it("keeps elements ordered when new ones are created in the editor", async () => {
      await render(<Excalidraw />);

      API.updateScene({
        elements: createUnorderedElements(),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      const created = API.createElement({ id: "new", type: "ellipse" });
      expect(created.index).toBeNull();

      API.updateScene({
        elements: [...h.elements, created],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      expectOrderedElements(h.elements, ["el-0", "el-1", "el-2", "new"]);
    });
  });
});
