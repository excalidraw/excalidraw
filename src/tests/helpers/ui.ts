import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "../../element/types";
import { CODES } from "../../keys";
import { ToolName } from "../queries/toolQueries";
import { fireEvent, GlobalTestState } from "../test-utils";
import { API } from "./api";

const { h } = window;

let altKey = false;
let shiftKey = false;
let ctrlKey = false;

export type KeyboardModifiers = {
  alt?: boolean;
  shift?: boolean;
  ctrl?: boolean;
};
export class Keyboard {
  static withModifierKeys = (modifiers: KeyboardModifiers, cb: () => void) => {
    const prevAltKey = altKey;
    const prevShiftKey = shiftKey;
    const prevCtrlKey = ctrlKey;

    altKey = !!modifiers.alt;
    shiftKey = !!modifiers.shift;
    ctrlKey = !!modifiers.ctrl;

    try {
      cb();
    } finally {
      altKey = prevAltKey;
      shiftKey = prevShiftKey;
      ctrlKey = prevCtrlKey;
    }
  };

  static keyDown = (key: string) => {
    fireEvent.keyDown(document, {
      key,
      ctrlKey,
      shiftKey,
      altKey,
    });
  };

  static keyUp = (key: string) => {
    fireEvent.keyUp(document, {
      key,
      ctrlKey,
      shiftKey,
      altKey,
    });
  };

  static keyPress = (key: string) => {
    Keyboard.keyDown(key);
    Keyboard.keyUp(key);
  };

  static codeDown = (code: string) => {
    fireEvent.keyDown(document, {
      code,
      ctrlKey,
      shiftKey,
      altKey,
    });
  };

  static codeUp = (code: string) => {
    fireEvent.keyUp(document, {
      code,
      ctrlKey,
      shiftKey,
      altKey,
    });
  };

  static codePress = (code: string) => {
    Keyboard.codeDown(code);
    Keyboard.codeUp(code);
  };
}

export class Pointer {
  private clientX = 0;
  private clientY = 0;

  constructor(
    private readonly pointerType: "mouse" | "touch" | "pen",
    private readonly pointerId = 1,
  ) {}

  reset() {
    this.clientX = 0;
    this.clientY = 0;
  }

  getPosition() {
    return [this.clientX, this.clientY];
  }

  restorePosition(x = 0, y = 0) {
    this.clientX = x;
    this.clientY = y;
    fireEvent.pointerMove(GlobalTestState.canvas, this.getEvent());
  }

  private getEvent() {
    return {
      clientX: this.clientX,
      clientY: this.clientY,
      pointerType: this.pointerType,
      pointerId: this.pointerId,
      altKey,
      shiftKey,
      ctrlKey,
    };
  }

  move(dx: number, dy: number) {
    if (dx !== 0 || dy !== 0) {
      this.clientX += dx;
      this.clientY += dy;
      fireEvent.pointerMove(GlobalTestState.canvas, this.getEvent());
    }
  }

  down(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.pointerDown(GlobalTestState.canvas, this.getEvent());
  }

  up(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.pointerUp(GlobalTestState.canvas, this.getEvent());
  }

  click(dx = 0, dy = 0) {
    this.down(dx, dy);
    this.up();
  }

  doubleClick(dx = 0, dy = 0) {
    this.move(dx, dy);
    fireEvent.doubleClick(GlobalTestState.canvas, this.getEvent());
  }

  select(
    /** if multiple elements supplied, they're shift-selected */
    elements: ExcalidrawElement | ExcalidrawElement[],
  ) {
    API.clearSelection();
    Keyboard.withModifierKeys({ shift: true }, () => {
      elements = Array.isArray(elements) ? elements : [elements];
      elements.forEach((element) => {
        this.reset();
        this.click(element.x, element.y);
      });
    });
    this.reset();
  }

  clickOn(element: ExcalidrawElement) {
    this.reset();
    this.click(element.x, element.y);
    this.reset();
  }

  doubleClickOn(element: ExcalidrawElement) {
    this.reset();
    this.doubleClick(element.x, element.y);
    this.reset();
  }
}

const mouse = new Pointer("mouse");

export class UI {
  static clickTool = (toolName: ToolName) => {
    fireEvent.click(GlobalTestState.renderResult.getByToolName(toolName));
  };

  /**
   * Creates an Excalidraw element, and returns a proxy that wraps it so that
   * accessing props will return the latest ones from the object existing in
   * the app's elements array. This is because across the app lifecycle we tend
   * to recreate element objects and the returned reference will become stale.
   *
   * If you need to get the actual element, not the proxy, call `get()` method
   * on the proxy object.
   */
  static createElement<T extends ToolName>(
    type: T,
    {
      position = 0,
      x = position,
      y = position,
      size = 10,
      width = size,
      height = width,
    }: {
      position?: number;
      x?: number;
      y?: number;
      size?: number;
      width?: number;
      height?: number;
    } = {},
  ): (T extends "arrow" | "line" | "draw"
    ? ExcalidrawLinearElement
    : T extends "text"
    ? ExcalidrawTextElement
    : ExcalidrawElement) & {
    /** Returns the actual, current element from the elements array, instead
        of the proxy */
    get(): T extends "arrow" | "line" | "draw"
      ? ExcalidrawLinearElement
      : T extends "text"
      ? ExcalidrawTextElement
      : ExcalidrawElement;
  } {
    UI.clickTool(type);
    mouse.reset();
    mouse.down(x, y);
    mouse.reset();
    mouse.up(x + (width ?? height ?? size), y + (height ?? size));

    const origElement = h.elements[h.elements.length - 1] as any;

    return new Proxy(
      {},
      {
        get(target, prop) {
          const currentElement = h.elements.find(
            (element) => element.id === origElement.id,
          ) as any;
          if (prop === "get") {
            if (currentElement.hasOwnProperty("get")) {
              throw new Error(
                "trying to get `get` test property, but ExcalidrawElement seems to define its own",
              );
            }
            return () => currentElement;
          }
          return currentElement[prop];
        },
      },
    ) as any;
  }

  static group(elements: ExcalidrawElement[]) {
    mouse.select(elements);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.G);
    });
  }
}
