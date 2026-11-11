import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { ObservedAppState } from "@excalidraw/excalidraw/types";
import type { LinearElementEditor } from "@excalidraw/element";
import type {
  ExcalidrawTextElement,
  FractionalIndex,
  SceneElementsMap,
} from "@excalidraw/element/types";

import { AppStateDelta, Delta, ElementsDelta } from "../src/delta";
import { mutateElement, newElementWith } from "../src/mutateElement";

describe("ElementsDelta", () => {
  describe("visible changes", () => {
    const apply = (before: SceneElementsMap, after: SceneElementsMap) =>
      ElementsDelta.calculate(before, after).applyTo(before, before, {
        excludedProperties: new Set(["version", "versionNonce"]),
      });

    const boundText = (
      type: "rectangle" | "stickynote" | "arrow",
      text = "",
    ) => {
      const container = API.createElement({
        type,
        id: "container",
        index: "a0" as FractionalIndex,
        width: 250,
        height: type === "arrow" ? 0 : 250,
        baseHeight: type === "stickynote" ? 250 : undefined,
        points:
          type === "arrow" ? [pointFrom(0, 0), pointFrom(250, 0)] : undefined,
        boundElements: [{ id: "label", type: "text" }],
      });
      const label: ExcalidrawTextElement = {
        ...API.createElement({
          type: "text",
          id: "label",
          index: "a1" as FractionalIndex,
          containerId: container.id,
          fontSize: 20,
          textAlign: "center",
          verticalAlign: "middle",
        }),
        // API.createElement substitutes "test" for an empty string.
        text,
        originalText: text,
      };
      const before = arrayToMap([container, label]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(container, { boundElements: [] }),
        newElementWith(label, { isDeleted: true }),
      ]) as SceneElementsMap;
      return { container, label, before, after };
    };

    it.each(["rectangle", "stickynote"] as const)(
      "ignores empty-label deletion and restoration on a %s",
      (type) => {
        const { before, after, container, label } = boundText(type);
        const [deleted, deletionIsVisible] = apply(before, after);
        expect(deletionIsVisible).toBe(false);
        expect(deleted.get(label.id)?.isDeleted).toBe(true);
        expect(deleted.get(container.id)?.boundElements).toEqual([]);

        const [restored, restorationIsVisible] = apply(after, before);
        expect(restorationIsVisible).toBe(false);
        expect(restored.get(label.id)?.isDeleted).toBe(false);
        expect(restored.get(container.id)?.boundElements).toEqual([
          { id: label.id, type: "text" },
        ]);
      },
    );

    it("keeps deletion and restoration of nonempty labels visible", () => {
      const { before, after } = boundText("stickynote", "hello");
      expect(apply(before, after)[1]).toBe(true);
      expect(apply(after, before)[1]).toBe(true);
    });

    it.each(["excluded", "already applied"])(
      "ignores %s properties when deciding visibility",
      (mode) => {
        const element = API.createElement({
          type: "rectangle",
          index: "a0" as FractionalIndex,
        });
        const before = arrayToMap([element]) as SceneElementsMap;
        const after = arrayToMap([
          newElementWith(element, { strokeColor: "red" }),
        ]) as SceneElementsMap;
        const delta = ElementsDelta.calculate(before, after);
        const current = mode === "excluded" ? before : after;
        const [elements, isVisible] = delta.applyTo(current, current, {
          excludedProperties: new Set([
            "version",
            "versionNonce",
            ...(mode === "excluded" ? ["strokeColor" as const] : []),
          ]),
        });

        expect(elements.get(element.id)?.strokeColor).toBe(
          current.get(element.id)?.strokeColor,
        );
        expect(isVisible).toBe(false);
      },
    );

    it("keeps snapshot restoration visible for a metadata-only update", () => {
      const element = API.createElement({
        type: "rectangle",
        index: "a0" as FractionalIndex,
      });
      const before = arrayToMap([element]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(element, { version: element.version + 1 }),
      ]) as SceneElementsMap;
      const delta = ElementsDelta.calculate(before, after);
      const [elements, isVisible] = delta.applyTo(
        new Map() as SceneElementsMap,
        before,
      );

      expect(elements.get(element.id)?.isDeleted).toBe(false);
      expect(isVisible).toBe(true);
    });

    it("keeps an arrow's empty-label gap visible", () => {
      const { before, after } = boundText("arrow");
      expect(apply(before, after)[1]).toBe(true);
      expect(apply(after, before)[1]).toBe(true);
    });

    it("detects a container resized by restoring an empty label", () => {
      const { container, label } = boundText("rectangle");
      const smallContainer = newElementWith(container, {
        width: 20,
        height: 10,
        boundElements: [],
      });
      const before = arrayToMap([
        smallContainer,
        newElementWith(label, { isDeleted: true }),
      ]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(smallContainer, {
          boundElements: [{ id: label.id, type: "text" }],
        }),
        newElementWith(label, { isDeleted: false }),
      ]) as SceneElementsMap;

      const [elements, isVisible] = apply(before, after);
      expect(elements.get(container.id)?.height).toBeGreaterThan(10);
      expect(isVisible).toBe(true);
    });

    it("detects a bound label repositioned by a container's redraw", () => {
      const { container, label } = boundText("rectangle", "hello");
      const misplacedLabel = newElementWith(label, { x: -100, y: -100 });
      const before = arrayToMap([
        container,
        misplacedLabel,
      ]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(container, { version: container.version + 1 }),
        misplacedLabel,
      ]) as SceneElementsMap;

      const [elements, isVisible] = apply(before, after);
      expect(elements.get(container.id)?.height).toBe(container.height);
      expect(elements.get(label.id)?.x).not.toBe(-100);
      expect(isVisible).toBe(true);
    });

    it("detects a bound arrow repositioned by a container's redraw", () => {
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        index: "a0" as FractionalIndex,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        index: "a1" as FractionalIndex,
        x: 200,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(100, 0)],
        startBinding: {
          elementId: container.id,
          mode: "orbit",
          fixedPoint: [1, 0.5],
        },
      });
      const before = arrayToMap([container, arrow]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(container, { version: container.version + 1 }),
        arrow,
      ]) as SceneElementsMap;

      const [elements, isVisible] = apply(before, after);
      expect(elements.get(container.id)?.width).toBe(container.width);
      expect(elements.get(arrow.id)?.x).not.toBe(200);
      expect(isVisible).toBe(true);
    });

    it.each(["test", "development", "production"])(
      "guards against untracked layout mutations in %s mode",
      (mode) => {
        const element = API.createElement({
          type: "rectangle",
          id: "changed",
          index: "a0" as FractionalIndex,
        });
        const unrelated = API.createElement({
          type: "rectangle",
          id: "unrelated",
          index: "a1" as FractionalIndex,
        });
        const before = arrayToMap([element, unrelated]) as SceneElementsMap;
        const after = arrayToMap([
          newElementWith(element, { strokeColor: "red" }),
          unrelated,
        ]) as SceneElementsMap;
        // Simulate a future layout dependency missing from idsToCheck.
        // Mutate the shared instance so the guard must snapshot version values.
        const redraw = vi
          .spyOn(ElementsDelta, "redrawElements")
          .mockImplementationOnce((elements) => {
            mutateElement(elements.get(unrelated.id)!, elements, {
              x: unrelated.x + 1,
            });
            return elements;
          });
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        vi.stubEnv("MODE", mode);

        try {
          if (mode === "production") {
            expect(apply(before, after)[1]).toBe(true);
            expect(consoleError).not.toHaveBeenCalled();
          } else {
            expect(() => apply(before, after)).toThrow(
              'Redrawn element "unrelated" is missing from idsToCheck',
            );
          }
        } finally {
          redraw.mockRestore();
          consoleError.mockRestore();
          vi.unstubAllEnvs();
        }
      },
    );

    it("keeps an empty text element's arrow bindings visible", () => {
      const label: ExcalidrawTextElement = {
        ...API.createElement({
          type: "text",
          id: "label",
          index: "a0" as FractionalIndex,
          boundElements: [{ id: "arrow", type: "arrow" }],
        }),
        text: "",
        originalText: "",
      };
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        index: "a1" as FractionalIndex,
        startBinding: {
          elementId: label.id,
          mode: "orbit",
          fixedPoint: [1, 0.5],
        },
      });
      const before = arrayToMap([label, arrow]) as SceneElementsMap;
      const after = arrayToMap([
        newElementWith(label, { isDeleted: true, boundElements: [] }),
        newElementWith(arrow, { startBinding: null }),
      ]) as SceneElementsMap;
      expect(apply(before, after)[1]).toBe(true);
    });
  });

  describe("elements delta calculation", () => {
    it("should not throw when element gets removed but was already deleted", () => {
      const element = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        isDeleted: true,
      });

      const prevElements = new Map([[element.id, element]]);
      const nextElements = new Map();

      expect(() =>
        ElementsDelta.calculate(prevElements, nextElements),
      ).not.toThrow();
    });

    it("should not throw when adding element as already deleted", () => {
      const element = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        isDeleted: true,
      });

      const prevElements = new Map();
      const nextElements = new Map([[element.id, element]]);

      expect(() =>
        ElementsDelta.calculate(prevElements, nextElements),
      ).not.toThrow();
    });

    it("should create updated delta even when there is only version and versionNonce change", () => {
      const baseElement = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        strokeColor: "#000000",
        backgroundColor: "#ffffff",
      });

      const modifiedElement = {
        ...baseElement,
        version: baseElement.version + 1,
        versionNonce: baseElement.versionNonce + 1,
      };

      // Create maps for the delta calculation
      const prevElements = new Map([[baseElement.id, baseElement]]);
      const nextElements = new Map([[modifiedElement.id, modifiedElement]]);

      // Calculate the delta
      const delta = ElementsDelta.calculate(
        prevElements as SceneElementsMap,
        nextElements as SceneElementsMap,
      );

      expect(delta).toEqual(
        ElementsDelta.create(
          {},
          {},
          {
            [baseElement.id]: Delta.create(
              {
                version: baseElement.version,
                versionNonce: baseElement.versionNonce,
              },
              {
                version: baseElement.version + 1,
                versionNonce: baseElement.versionNonce + 1,
              },
            ),
          },
        ),
      );
    });
  });

  describe("squash", () => {
    it("should not squash when second delta is empty", () => {
      const updatedDelta = Delta.create(
        { x: 100, version: 1, versionNonce: 1 },
        { x: 200, version: 2, versionNonce: 2 },
      );

      const elementsDelta1 = ElementsDelta.create(
        {},
        {},
        { id1: updatedDelta },
      );
      const elementsDelta2 = ElementsDelta.empty();
      const elementsDelta = elementsDelta1.squash(elementsDelta2);

      expect(elementsDelta.isEmpty()).toBeFalsy();
      expect(elementsDelta).toBe(elementsDelta1);
      expect(elementsDelta.updated.id1).toBe(updatedDelta);
    });

    it("should squash mutually exclusive delta types", () => {
      const addedDelta = Delta.create(
        { x: 100, version: 1, versionNonce: 1, isDeleted: true },
        { x: 200, version: 2, versionNonce: 2, isDeleted: false },
      );

      const removedDelta = Delta.create(
        { x: 100, version: 1, versionNonce: 1, isDeleted: false },
        { x: 200, version: 2, versionNonce: 2, isDeleted: true },
      );

      const updatedDelta = Delta.create(
        { x: 100, version: 1, versionNonce: 1 },
        { x: 200, version: 2, versionNonce: 2 },
      );

      const elementsDelta1 = ElementsDelta.create(
        { id1: addedDelta },
        { id2: removedDelta },
        {},
      );

      const elementsDelta2 = ElementsDelta.create(
        {},
        {},
        { id3: updatedDelta },
      );

      const elementsDelta = elementsDelta1.squash(elementsDelta2);

      expect(elementsDelta.isEmpty()).toBeFalsy();
      expect(elementsDelta).toBe(elementsDelta1);
      expect(elementsDelta.added.id1).toBe(addedDelta);
      expect(elementsDelta.removed.id2).toBe(removedDelta);
      expect(elementsDelta.updated.id3).toBe(updatedDelta);
    });

    it("should squash the same delta types", () => {
      const elementsDelta1 = ElementsDelta.create(
        {
          id1: Delta.create(
            { x: 100, version: 1, versionNonce: 1, isDeleted: true },
            { x: 200, version: 2, versionNonce: 2, isDeleted: false },
          ),
        },
        {
          id2: Delta.create(
            { x: 100, version: 1, versionNonce: 1, isDeleted: false },
            { x: 200, version: 2, versionNonce: 2, isDeleted: true },
          ),
        },
        {
          id3: Delta.create(
            { x: 100, version: 1, versionNonce: 1 },
            { x: 200, version: 2, versionNonce: 2 },
          ),
        },
      );

      const elementsDelta2 = ElementsDelta.create(
        {
          id1: Delta.create(
            { y: 100, version: 2, versionNonce: 2, isDeleted: true },
            { y: 200, version: 3, versionNonce: 3, isDeleted: false },
          ),
        },
        {
          id2: Delta.create(
            { y: 100, version: 2, versionNonce: 2, isDeleted: false },
            { y: 200, version: 3, versionNonce: 3, isDeleted: true },
          ),
        },
        {
          id3: Delta.create(
            { y: 100, version: 2, versionNonce: 2 },
            { y: 200, version: 3, versionNonce: 3 },
          ),
        },
      );

      const elementsDelta = elementsDelta1.squash(elementsDelta2);

      expect(elementsDelta.isEmpty()).toBeFalsy();
      expect(elementsDelta).toBe(elementsDelta1);
      expect(elementsDelta.added.id1).toEqual(
        Delta.create(
          { x: 100, y: 100, version: 2, versionNonce: 2, isDeleted: true },
          { x: 200, y: 200, version: 3, versionNonce: 3, isDeleted: false },
        ),
      );
      expect(elementsDelta.removed.id2).toEqual(
        Delta.create(
          { x: 100, y: 100, version: 2, versionNonce: 2, isDeleted: false },
          { x: 200, y: 200, version: 3, versionNonce: 3, isDeleted: true },
        ),
      );
      expect(elementsDelta.updated.id3).toEqual(
        Delta.create(
          { x: 100, y: 100, version: 2, versionNonce: 2 },
          { x: 200, y: 200, version: 3, versionNonce: 3 },
        ),
      );
    });

    it("should squash different delta types ", () => {
      // id1: added   -> updated => added
      // id2: removed -> added   => added
      // id3: updated -> removed => removed
      const elementsDelta1 = ElementsDelta.create(
        {
          id1: Delta.create(
            { x: 100, version: 1, versionNonce: 1, isDeleted: true },
            { x: 101, version: 2, versionNonce: 2, isDeleted: false },
          ),
        },
        {
          id2: Delta.create(
            { x: 200, version: 1, versionNonce: 1, isDeleted: false },
            { x: 201, version: 2, versionNonce: 2, isDeleted: true },
          ),
        },
        {
          id3: Delta.create(
            { x: 300, version: 1, versionNonce: 1 },
            { x: 301, version: 2, versionNonce: 2 },
          ),
        },
      );

      const elementsDelta2 = ElementsDelta.create(
        {
          id2: Delta.create(
            { y: 200, version: 2, versionNonce: 2, isDeleted: true },
            { y: 201, version: 3, versionNonce: 3, isDeleted: false },
          ),
        },
        {
          id3: Delta.create(
            { y: 300, version: 2, versionNonce: 2, isDeleted: false },
            { y: 301, version: 3, versionNonce: 3, isDeleted: true },
          ),
        },
        {
          id1: Delta.create(
            { y: 100, version: 2, versionNonce: 2 },
            { y: 101, version: 3, versionNonce: 3 },
          ),
        },
      );

      const elementsDelta = elementsDelta1.squash(elementsDelta2);

      expect(elementsDelta.isEmpty()).toBeFalsy();
      expect(elementsDelta).toBe(elementsDelta1);
      expect(elementsDelta.added).toEqual({
        id1: Delta.create(
          { x: 100, y: 100, version: 2, versionNonce: 2, isDeleted: true },
          { x: 101, y: 101, version: 3, versionNonce: 3, isDeleted: false },
        ),
        id2: Delta.create(
          { x: 200, y: 200, version: 2, versionNonce: 2, isDeleted: true },
          { x: 201, y: 201, version: 3, versionNonce: 3, isDeleted: false },
        ),
      });
      expect(elementsDelta.removed).toEqual({
        id3: Delta.create(
          { x: 300, y: 300, version: 2, versionNonce: 2, isDeleted: false },
          { x: 301, y: 301, version: 3, versionNonce: 3, isDeleted: true },
        ),
      });
      expect(elementsDelta.updated).toEqual({});
    });

    it("should squash bound elements", () => {
      const elementsDelta1 = ElementsDelta.create(
        {},
        {},
        {
          id1: Delta.create(
            {
              version: 1,
              versionNonce: 1,
              boundElements: [{ id: "t1", type: "text" }],
            },
            {
              version: 2,
              versionNonce: 2,
              boundElements: [{ id: "t2", type: "text" }],
            },
          ),
        },
      );

      const elementsDelta2 = ElementsDelta.create(
        {},
        {},
        {
          id1: Delta.create(
            {
              version: 2,
              versionNonce: 2,
              boundElements: [{ id: "a1", type: "arrow" }],
            },
            {
              version: 3,
              versionNonce: 3,
              boundElements: [{ id: "a2", type: "arrow" }],
            },
          ),
        },
      );

      const elementsDelta = elementsDelta1.squash(elementsDelta2);

      expect(elementsDelta.updated.id1.deleted.boundElements).toEqual([
        { id: "t1", type: "text" },
        { id: "a1", type: "arrow" },
      ]);
      expect(elementsDelta.updated.id1.inserted.boundElements).toEqual([
        { id: "t2", type: "text" },
        { id: "a2", type: "arrow" },
      ]);
    });
  });
});

describe("AppStateDelta", () => {
  describe("ensure stable delta properties order", () => {
    it("should maintain stable order for root properties", () => {
      const name = "untitled scene";
      const selectedLinearElement = {
        elementId: "id1" as LinearElementEditor["elementId"],
        isEditing: false,
      };

      const commonAppState = {
        viewBackgroundColor: "#ffffff",
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
        croppingElementId: null,
        editingLinearElementId: null,
        selectedLinearElementIsEditing: null,
        lockedMultiSelections: {},
        activeLockedId: null,
      };

      const prevAppState1: ObservedAppState = {
        ...commonAppState,
        name: "",
        selectedLinearElement: null,
      };

      const nextAppState1: ObservedAppState = {
        ...commonAppState,
        name,
        selectedLinearElement,
      };

      const prevAppState2: ObservedAppState = {
        selectedLinearElement: null,
        name: "",
        ...commonAppState,
      };

      const nextAppState2: ObservedAppState = {
        selectedLinearElement,
        name,
        ...commonAppState,
      };

      const delta1 = AppStateDelta.calculate(prevAppState1, nextAppState1);
      const delta2 = AppStateDelta.calculate(prevAppState2, nextAppState2);

      expect(JSON.stringify(delta1)).toBe(JSON.stringify(delta2));
    });

    it("should maintain stable order for selectedElementIds", () => {
      const commonAppState = {
        name: "",
        viewBackgroundColor: "#ffffff",
        selectedGroupIds: {},
        editingGroupId: null,
        croppingElementId: null,
        selectedLinearElement: null,
        activeLockedId: null,
        lockedMultiSelections: {},
      };

      const prevAppState1: ObservedAppState = {
        ...commonAppState,
        selectedElementIds: { id5: true, id2: true, id4: true },
      };

      const nextAppState1: ObservedAppState = {
        ...commonAppState,
        selectedElementIds: {
          id1: true,
          id2: true,
          id3: true,
        },
      };

      const prevAppState2: ObservedAppState = {
        ...commonAppState,
        selectedElementIds: { id4: true, id2: true, id5: true },
      };

      const nextAppState2: ObservedAppState = {
        ...commonAppState,
        selectedElementIds: {
          id3: true,
          id2: true,
          id1: true,
        },
      };

      const delta1 = AppStateDelta.calculate(prevAppState1, nextAppState1);
      const delta2 = AppStateDelta.calculate(prevAppState2, nextAppState2);

      expect(JSON.stringify(delta1)).toBe(JSON.stringify(delta2));
    });

    it("should maintain stable order for selectedGroupIds", () => {
      const commonAppState = {
        name: "",
        viewBackgroundColor: "#ffffff",
        selectedElementIds: {},
        editingGroupId: null,
        croppingElementId: null,
        selectedLinearElement: null,
        activeLockedId: null,
        lockedMultiSelections: {},
      };

      const prevAppState1: ObservedAppState = {
        ...commonAppState,
        selectedGroupIds: { id5: false, id2: true, id4: true, id0: true },
      };

      const nextAppState1: ObservedAppState = {
        ...commonAppState,
        selectedGroupIds: {
          id0: true,
          id1: true,
          id2: false,
          id3: true,
        },
      };

      const prevAppState2: ObservedAppState = {
        ...commonAppState,
        selectedGroupIds: { id0: true, id4: true, id2: true, id5: false },
      };

      const nextAppState2: ObservedAppState = {
        ...commonAppState,
        selectedGroupIds: {
          id3: true,
          id2: false,
          id1: true,
          id0: true,
        },
      };

      const delta1 = AppStateDelta.calculate(prevAppState1, nextAppState1);
      const delta2 = AppStateDelta.calculate(prevAppState2, nextAppState2);

      expect(JSON.stringify(delta1)).toBe(JSON.stringify(delta2));
    });
  });

  describe("squash", () => {
    it("should not squash when second delta is empty", () => {
      const delta = Delta.create(
        { name: "untitled scene" },
        { name: "titled scene" },
      );

      const appStateDelta1 = AppStateDelta.create(delta);
      const appStateDelta2 = AppStateDelta.empty();
      const appStateDelta = appStateDelta1.squash(appStateDelta2);

      expect(appStateDelta.isEmpty()).toBeFalsy();
      expect(appStateDelta).toBe(appStateDelta1);
      expect(appStateDelta.delta).toBe(delta);
    });

    it("should squash exclusive properties", () => {
      const delta1 = Delta.create(
        { name: "untitled scene" },
        { name: "titled scene" },
      );
      const delta2 = Delta.create(
        { viewBackgroundColor: "#ffffff" },
        { viewBackgroundColor: "#000000" },
      );

      const appStateDelta1 = AppStateDelta.create(delta1);
      const appStateDelta2 = AppStateDelta.create(delta2);
      const appStateDelta = appStateDelta1.squash(appStateDelta2);

      expect(appStateDelta.isEmpty()).toBeFalsy();
      expect(appStateDelta).toBe(appStateDelta1);
      expect(appStateDelta.delta).toEqual(
        Delta.create(
          { name: "untitled scene", viewBackgroundColor: "#ffffff" },
          { name: "titled scene", viewBackgroundColor: "#000000" },
        ),
      );
    });

    it("should squash selectedElementIds, selectedGroupIds and lockedMultiSelections", () => {
      const delta1 = Delta.create<Partial<ObservedAppState>>(
        {
          name: "untitled scene",
          selectedElementIds: { id1: true },
          selectedGroupIds: {},
          lockedMultiSelections: { g1: true },
        },
        {
          name: "titled scene",
          selectedElementIds: { id2: true },
          selectedGroupIds: { g1: true },
          lockedMultiSelections: {},
        },
      );
      const delta2 = Delta.create<Partial<ObservedAppState>>(
        {
          selectedElementIds: { id3: true },
          selectedGroupIds: { g1: true },
          lockedMultiSelections: {},
        },
        {
          selectedElementIds: { id2: true },
          selectedGroupIds: { g2: true, g3: true },
          lockedMultiSelections: { g3: true },
        },
      );

      const appStateDelta1 = AppStateDelta.create(delta1);
      const appStateDelta2 = AppStateDelta.create(delta2);
      const appStateDelta = appStateDelta1.squash(appStateDelta2);

      expect(appStateDelta.isEmpty()).toBeFalsy();
      expect(appStateDelta).toBe(appStateDelta1);
      expect(appStateDelta.delta).toEqual(
        Delta.create<Partial<ObservedAppState>>(
          {
            name: "untitled scene",
            selectedElementIds: { id1: true, id3: true },
            selectedGroupIds: { g1: true },
            lockedMultiSelections: { g1: true },
          },
          {
            name: "titled scene",
            selectedElementIds: { id2: true },
            selectedGroupIds: { g1: true, g2: true, g3: true },
            lockedMultiSelections: { g3: true },
          },
        ),
      );
    });
  });
});
