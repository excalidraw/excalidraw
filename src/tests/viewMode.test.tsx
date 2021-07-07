import React from "react";
import ReactDOM from "react-dom";
import {
  render,
  GlobalTestState
} from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { KEYS } from "../keys";
import { Keyboard, Pointer } from "./helpers/ui";
import { CURSOR_TYPE } from "../constants";

const { h } = window;
const mouse = new Pointer("mouse");

describe("view mode", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
  });

  it("after switching to view mode – cursor type should be pointer", async () => {
    h.setState({viewModeEnabled: true});
    expect(GlobalTestState.canvas.style._values.cursor).toBe(CURSOR_TYPE.POINTER);
  });

  it("after switching to view mode, moving, clicking, and pressing space key – cursor type should be pointer", async () => {
    h.setState({viewModeEnabled: true});
    mouse.reset();
    mouse.move(100, 100);
    mouse.click();
    Keyboard.keyPress(KEYS.SPACE);
    expect(GlobalTestState.canvas.style._values.cursor).toBe(CURSOR_TYPE.POINTER);
  });

});
