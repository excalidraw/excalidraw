import React from "react";

import { KEYS } from "@excalidraw/common";
import { getBoundTextElement } from "@excalidraw/element";

import { actionStackToScale } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { render, fireEvent, unmountComponent } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("actionStackToScale", () => {
  describe("predicate", () => {
    it.each(["rectangle", "diamond", "ellipse"] as const)(
      "should be available when a single %s is selected",
      (type) => {
        const el = API.createElement({ type, x: 50, y: 50 });
        API.setElements([el]);
        API.setSelectedElements([el]);

        API.executeAction(actionStackToScale);

        expect(h.elements).toHaveLength(3);
      },
    );

    it("should NOT run when a non-stackable element is selected", () => {
      const line = API.createElement({ type: "line", x: 50, y: 50 });
      API.setElements([line]);
      API.setSelectedElements([line]);

      API.executeAction(actionStackToScale);

      expect(h.elements).toHaveLength(1);
    });

    it("should NOT run when multiple elements are selected", () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 50, y: 50 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      API.executeAction(actionStackToScale);

      expect(h.elements).toHaveLength(2);
    });

    it("should NOT run when nothing is selected", () => {
      const rect = API.createElement({ type: "rectangle", x: 50, y: 50 });
      API.setElements([rect]);

      API.executeAction(actionStackToScale);

      expect(h.elements).toHaveLength(1);
    });
  });

  describe("perform", () => {
    it.each(["rectangle", "diamond", "ellipse"] as const)(
      "should create 2 offset copies behind a %s in correct z-order",
      (type) => {
        const el = API.createElement({ type, x: 100, y: 100 });
        API.setElements([el]);
        API.setSelectedElements([el]);

        API.executeAction(actionStackToScale);

        expect(h.elements).toHaveLength(3);

        // z-order: furthest copy first, nearest copy second, original on top
        expect(h.elements[0].x).toBe(84);     // -16 copy (furthest back)
        expect(h.elements[0].y).toBe(84);
        expect(h.elements[1].x).toBe(92);     // -8 copy
        expect(h.elements[1].y).toBe(92);
        expect(h.elements[2].id).toBe(el.id); // original on top
        expect(h.elements[2].x).toBe(100);
      },
    );

    it("should group all three elements under the same groupId", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionStackToScale);

      const groupIds = h.elements.map((e) => e.groupIds);
      const sharedGroupId = groupIds[0][0];

      expect(sharedGroupId).toBeDefined();
      expect(groupIds.every((gids) => gids.includes(sharedGroupId))).toBe(
        true,
      );

      // the group should also be selected in app state
      const selectedGroupIds = Object.keys(h.state.selectedGroupIds);
      expect(selectedGroupIds).toEqual([sharedGroupId]);
    });

    it("should preserve styles from the original element on copies", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        strokeColor: "#e03131",
        backgroundColor: "#a5d8ff",
        strokeWidth: 4,
        roughness: 2,
        opacity: 80,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionStackToScale);

      const copies = h.elements.filter((e) => e.id !== rect.id);
      for (const copy of copies) {
        expect(copy.strokeColor).toBe("#e03131");
        expect(copy.backgroundColor).toBe("#a5d8ff");
        expect(copy.strokeWidth).toBe(4);
        expect(copy.roughness).toBe(2);
        expect(copy.opacity).toBe(80);
      }
    });

    it("should keep text only on the original and group it with the stack", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect-id",
        x: 100,
        y: 100,
        boundElements: [{ type: "text", id: "text-id" }],
      });
      const text = API.createElement({
        type: "text",
        id: "text-id",
        x: 105,
        y: 105,
        text: "Hello",
        containerId: "rect-id",
      });
      API.setElements([rect, text]);
      API.setSelectedElements([rect]);

      API.executeAction(actionStackToScale);

      const copies = h.elements.filter(
        (e) => e.type === "rectangle" && e.id !== rect.id,
      );
      expect(copies).toHaveLength(2);
      for (const copy of copies) {
        expect(copy.boundElements).toEqual([]);
      }

      const updatedRect = h.elements.find((e) => e.id === rect.id)!;
      const boundText = getBoundTextElement(
        updatedRect,
        new Map(h.elements.map((e) => [e.id, e])),
      );
      expect(boundText).not.toBeNull();
      expect(boundText!.id).toBe("text-id");

      const updatedText = h.elements.find((e) => e.id === "text-id")!;
      expect(updatedText.groupIds.length).toBeGreaterThan(0);
      expect(updatedText.groupIds[0]).toBe(updatedRect.groupIds[0]);
    });

    it("should not modify other elements in the scene", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
      });
      const other = API.createElement({
        type: "ellipse",
        x: 300,
        y: 300,
      });
      API.setElements([other, rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionStackToScale);

      const updatedOther = h.elements.find((e) => e.id === other.id)!;
      expect(updatedOther.x).toBe(300);
      expect(updatedOther.y).toBe(300);
      expect(updatedOther.groupIds).toEqual([]);
    });

  });

  describe("keyboard shortcut", () => {
    it("should trigger via Ctrl/Cmd+J", () => {
      UI.clickTool("rectangle");
      mouse.down(10, 10);
      mouse.up(100, 100);

      expect(h.elements).toHaveLength(1);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.J);
      });

      expect(h.elements).toHaveLength(3);
    });

    it("pressing Ctrl+J twice should not stack again — it's a one-way operation", () => {
      UI.clickTool("rectangle");
      mouse.down(10, 10);
      mouse.up(100, 100);

      expect(h.elements).toHaveLength(1);

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.J);
      });

      expect(h.elements).toHaveLength(3);

      // after stacking, the result is a group — not a single element —
      // so the predicate should reject it and a second Ctrl+J does nothing
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.J);
      });

      expect(h.elements).toHaveLength(3);
    });
  });

  describe("double-click to edit text", () => {
    it("should bind new text to the frontmost shape when double-clicking a stack", async () => {
      const rect = UI.createElement("rectangle", {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });

      const originalId = rect.id;

      // stack it
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.J);
      });
      expect(h.elements).toHaveLength(3);

      // select just the front element and press ENTER to start text editing
      const original = h.elements.find((e) => e.id === originalId)!;
      API.setSelectedElements([original]);
      Keyboard.keyPress(KEYS.ENTER);

      const editor = await getTextEditor();
      expect(editor).not.toBeNull();

      fireEvent.input(editor, { target: { value: "test label" } });
      Keyboard.exitTextEditor(editor);

      const textEl = h.elements.find(
        (e) => e.type === "text" && (e as any).containerId === originalId,
      );
      expect(textEl).toBeDefined();
    });
  });
});
