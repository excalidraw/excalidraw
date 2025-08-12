import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { ObservedAppState } from "@excalidraw/excalidraw/types";
import type { LinearElementEditor } from "@excalidraw/element";
import type { SceneElementsMap } from "@excalidraw/element/types";

import { AppStateDelta, ElementsDelta } from "../src/delta";

describe("ElementsDelta", () => {
  describe("elements delta calculation", () => {
    it("should not create removed delta when element gets removed but was already deleted", () => {
      const element = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        isDeleted: true,
      });

      const prevElements = new Map([[element.id, element]]);
      const nextElements = new Map();

      const delta = ElementsDelta.calculate(prevElements, nextElements);

      expect(delta.isEmpty()).toBeTruthy();
    });

    it("should not create added delta when adding element as already deleted", () => {
      const element = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        isDeleted: true,
      });

      const prevElements = new Map();
      const nextElements = new Map([[element.id, element]]);

      const delta = ElementsDelta.calculate(prevElements, nextElements);

      expect(delta.isEmpty()).toBeTruthy();
    });

    it("should not create updated delta when there is only version and versionNonce change", () => {
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

      expect(delta.isEmpty()).toBeTruthy();
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
});
