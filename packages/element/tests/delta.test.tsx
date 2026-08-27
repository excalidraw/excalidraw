import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { ObservedAppState } from "@excalidraw/excalidraw/types";
import type { LinearElementEditor } from "@excalidraw/element";
import type { SceneElementsMap } from "@excalidraw/element/types";

import { AppStateDelta, Delta, ElementsDelta } from "../src/delta";

describe("ElementsDelta", () => {
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
