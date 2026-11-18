import React from "react";

import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

describe("Enter to edit a group (#8511)", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const createGroup = () => {
    const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({ type: "rectangle", x: 300 });
    API.setElements([rect1, rect2, rect3]);
    return { rect1, rect2, rect3 };
  };

  it("enters the selected group and selects all of its elements", () => {
    const { rect1, rect2 } = createGroup();
    API.setSelectedElements([rect1, rect2]);
    expect(h.state.selectedGroupIds).toEqual({ A: true });
    expect(h.state.editingGroupId).toBe(null);

    Keyboard.keyPress(KEYS.ENTER);

    expect(h.state.editingGroupId).toBe("A");
    expect(h.state.selectedElementIds).toEqual({
      [rect1.id]: true,
      [rect2.id]: true,
    });
    // elements are now selected individually, not as a group
    expect(h.state.selectedGroupIds).toEqual({});
  });

  it("enters only the outer group when groups are nested", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      groupIds: ["inner", "outer"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      groupIds: ["inner", "outer"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 200,
      groupIds: ["outer"],
    });
    API.setElements([rect1, rect2, rect3]);
    API.setSelectedElements([rect1, rect2, rect3]);
    expect(h.state.selectedGroupIds).toEqual({ outer: true });

    Keyboard.keyPress(KEYS.ENTER);

    expect(h.state.editingGroupId).toBe("outer");
    // the nested group stays selected as a group inside the edited group
    expect(h.state.selectedGroupIds).toEqual({ inner: true });

    // pressing Enter again enters the nested group
    API.setSelectedElements([rect1, rect2], "outer");
    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.editingGroupId).toBe("inner");
  });

  it("does nothing when the selection is not exactly one group", () => {
    const { rect1, rect2, rect3 } = createGroup();
    API.setSelectedElements([rect1, rect2, rect3]);

    Keyboard.keyPress(KEYS.ENTER);

    expect(h.state.editingGroupId).toBe(null);
    expect(h.state.selectedGroupIds).toEqual({ A: true });
  });

  it("keeps the existing behavior for a single ungrouped element", () => {
    const { rect3 } = createGroup();
    API.setSelectedElements([rect3]);

    Keyboard.keyPress(KEYS.ENTER);

    // Enter still starts editing the shape's text instead of a group
    expect(h.state.editingGroupId).toBe(null);
    expect(h.state.editingTextElement).not.toBe(null);
  });

  it("does not enter the group with Ctrl/Cmd+Enter", () => {
    const { rect1, rect2 } = createGroup();
    API.setSelectedElements([rect1, rect2]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ENTER);
    });

    expect(h.state.editingGroupId).toBe(null);
    expect(h.state.selectedGroupIds).toEqual({ A: true });
  });
});
