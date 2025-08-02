import type { ObservedAppState } from "@excalidraw/excalidraw/types";
import type { LinearElementEditor } from "@excalidraw/element";

import { AppStateDelta } from "../src/delta";

describe("AppStateDelta", () => {
  describe("ensure stable delta properties order", () => {
    it("should maintain stable order for root properties", () => {
      const name = "untitled scene";
      const selectedLinearElementId = "id1" as LinearElementEditor["elementId"];

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
        selectedLinearElementId: null,
      };

      const nextAppState1: ObservedAppState = {
        ...commonAppState,
        name,
        selectedLinearElementId,
      };

      const prevAppState2: ObservedAppState = {
        selectedLinearElementId: null,
        name: "",
        ...commonAppState,
      };

      const nextAppState2: ObservedAppState = {
        selectedLinearElementId,
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
        selectedLinearElementId: null,
        selectedLinearElementIsEditing: null,
        editingLinearElementId: null,
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
        selectedLinearElementId: null,
        selectedLinearElementIsEditing: null,
        editingLinearElementId: null,
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
