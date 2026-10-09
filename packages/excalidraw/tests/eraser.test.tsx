import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;
});

describe("Eraser tool", () => {
  it("erases ungrouped elements without polluting groupsToErase with undefined", () => {
    // Create a standalone rectangle (no group) at a known position
    const rect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    // Simulate eraser path crossing through the element
    act(() => {
      h.app.eraserTrail.startPath(0, 75);
      const elementsToErase = h.app.eraserTrail.addPointToPath(200, 75);

      // The ungrouped element should be marked for erasure
      expect(elementsToErase).toContain(rect.id);

      // Access the private groupsToErase set via type assertion
      const trail = h.app.eraserTrail as any;
      const groupsToErase: Set<string> = trail.groupsToErase;

      // groupsToErase must not contain undefined
      expect(groupsToErase.has(undefined as any)).toBe(false);
      expect(groupsToErase.size).toBe(0);

      h.app.eraserTrail.endPath();
    });
  });

  it("erases grouped elements and tracks group in groupsToErase", () => {
    const groupId = "test-group-1";

    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: [groupId],
    });

    const rect2 = API.createElement({
      type: "rectangle",
      x: 200,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
      groupIds: [groupId],
    });

    API.setElements([rect1, rect2]);

    act(() => {
      h.app.eraserTrail.startPath(0, 75);
      const elementsToErase = h.app.eraserTrail.addPointToPath(150, 75);

      // Both grouped elements should be marked for erasure
      expect(elementsToErase).toContain(rect1.id);
      expect(elementsToErase).toContain(rect2.id);

      const trail = h.app.eraserTrail as any;
      const groupsToErase: Set<string> = trail.groupsToErase;

      // The group should be tracked
      expect(groupsToErase.has(groupId)).toBe(true);
      expect(groupsToErase.has(undefined as any)).toBe(false);

      h.app.eraserTrail.endPath();
    });
  });

  it("handles mix of grouped and ungrouped elements without undefined pollution", () => {
    const groupId = "test-group-2";

    const ungroupedRect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    const groupedRect1 = API.createElement({
      type: "rectangle",
      x: 200,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
      groupIds: [groupId],
    });

    const groupedRect2 = API.createElement({
      type: "rectangle",
      x: 350,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: "green",
      fillStyle: "solid",
      groupIds: [groupId],
    });

    API.setElements([ungroupedRect, groupedRect1, groupedRect2]);

    act(() => {
      h.app.eraserTrail.startPath(0, 75);
      const elementsToErase = h.app.eraserTrail.addPointToPath(500, 75);

      // All elements should be marked for erasure
      expect(elementsToErase).toContain(ungroupedRect.id);
      expect(elementsToErase).toContain(groupedRect1.id);
      expect(elementsToErase).toContain(groupedRect2.id);

      const trail = h.app.eraserTrail as any;
      const groupsToErase: Set<string> = trail.groupsToErase;

      // Only the real group should be tracked, not undefined
      expect(groupsToErase.has(groupId)).toBe(true);
      expect(groupsToErase.has(undefined as any)).toBe(false);
      expect(groupsToErase.size).toBe(1);

      h.app.eraserTrail.endPath();
    });
  });
});
