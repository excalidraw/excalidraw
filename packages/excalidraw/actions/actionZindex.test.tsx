import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

const { h } = window;

describe("z-index shortcuts", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        initialData={{
          elements: [
            API.createElement({ id: "A", x: 0, y: 0, width: 100, height: 100 }),
            API.createElement({ id: "B", x: 0, y: 0, width: 100, height: 100 }),
          ],
        }}
      />,
    );
    // select the topmost element ("B")
    API.setSelectedElements([h.elements[1]]);
  });

  const ids = () => h.elements.map((el) => el.id);

  it("CtrlOrCmd+[ sends the selected element backward", () => {
    expect(ids()).toEqual(["A", "B"]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.BRACKET_LEFT);
    });

    expect(ids()).toEqual(["B", "A"]);
  });

  // regression: on macOS, "send to back" is CtrlOrCmd+Alt+[. The Alt
  // modifier must NOT also trigger `sendBackward`, otherwise two actions
  // match the same shortcut and the action manager cancels both.
  it("CtrlOrCmd+Alt+[ does not trigger sendBackward", () => {
    expect(ids()).toEqual(["A", "B"]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codePress(CODES.BRACKET_LEFT);
    });

    // sendBackward must not have run; order is unchanged
    expect(ids()).toEqual(["A", "B"]);
  });

  it("CtrlOrCmd+Alt+] does not trigger bringForward", () => {
    // select the bottommost element ("A")
    API.setSelectedElements([h.elements[0]]);
    expect(ids()).toEqual(["A", "B"]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codePress(CODES.BRACKET_RIGHT);
    });

    // bringForward must not have run; order is unchanged
    expect(ids()).toEqual(["A", "B"]);
  });
});
