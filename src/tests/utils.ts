import {
  getTransformHandles,
  TransformHandleDirection,
} from "../element/transformHandles";
import { ExcalidrawElement } from "../element/types";
import { Keyboard, KeyboardModifiers, Pointer } from "./helpers/ui";

const mouse = new Pointer("mouse");
const { h } = window;

export const resize = (
  element: ExcalidrawElement,
  handleDir: TransformHandleDirection,
  mouseMove: [number, number],
  keyboardModifiers: KeyboardModifiers = {},
) => {
  mouse.select(element);
  const handle = getTransformHandles(element, h.state.zoom, "mouse")[
    handleDir
  ]!;
  const clientX = handle[0] + handle[2] / 2;
  const clientY = handle[1] + handle[3] / 2;
  Keyboard.withModifierKeys(keyboardModifiers, () => {
    mouse.reset();
    mouse.down(clientX, clientY);
    mouse.move(mouseMove[0], mouseMove[1]);
    mouse.up();
  });
};

export const rotate = (
  element: ExcalidrawElement,
  deltaX: number,
  deltaY: number,
  keyboardModifiers: KeyboardModifiers = {},
) => {
  mouse.select(element);
  const handle = getTransformHandles(element, h.state.zoom, "mouse").rotation!;
  const clientX = handle[0] + handle[2] / 2;
  const clientY = handle[1] + handle[3] / 2;

  Keyboard.withModifierKeys(keyboardModifiers, () => {
    mouse.reset();
    mouse.down(clientX, clientY);
    mouse.move(clientX + deltaX, clientY + deltaY);
    mouse.up();
  });
};
