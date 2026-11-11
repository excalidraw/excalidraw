import { useEffect, useState } from "react";

import { Emitter, KEYS } from "@excalidraw/common";

export type HeldModifiers = Readonly<{
  alt: boolean;
  shift: boolean;
  /** Ctrl, or Cmd on macOS */
  ctrlOrCmd: boolean;
}>;

const NONE_HELD: HeldModifiers = {
  alt: false,
  shift: false,
  ctrlOrCmd: false,
};

const pick = (held: HeldModifiers, modifier?: keyof HeldModifiers) =>
  modifier ? held[modifier] : held;

/**
 * The modifier keys held over the editor, synced from the flags of its
 * keyboard and pointer events. Kept out of appState so that pressing one
 * re-renders only its subscribers (e.g. the hint).
 */
export class AppModifiers {
  private held = NONE_HELD;
  /** fires with a new snapshot whenever a modifier is pressed or released */
  readonly onChange = new Emitter<[held: HeldModifiers]>();

  get = (): HeldModifiers => this.held;

  /* eslint-disable react-hooks/rules-of-hooks -- called from function
     components; the lint takes any class method for a class component */
  /**
   * A hook re-rendering on the held modifiers: all of them, or with
   * `modifier`, only on that one being pressed or released.
   */
  useHeld(): HeldModifiers;
  useHeld(modifier: keyof HeldModifiers): boolean;
  useHeld(modifier?: keyof HeldModifiers) {
    const [held, setHeld] = useState(() => pick(this.held, modifier));
    useEffect(() => {
      // (setting a boolean that didn't change doesn't re-render)
      const update = () => setHeld(pick(this.held, modifier));
      // catches a change between the render and subscribing
      update();
      return this.onChange.on(update);
    }, [modifier]);
    return held;
  }
  /* eslint-enable react-hooks/rules-of-hooks */

  sync = (event: {
    altKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }) => {
    this.set({
      alt: event.altKey,
      shift: event.shiftKey,
      ctrlOrCmd: event[KEYS.CTRL_OR_CMD],
    });
  };

  /** releases them all — e.g. on blur, as Alt+Tab never delivers the keyup */
  reset = () => {
    this.set(NONE_HELD);
  };

  private set(held: HeldModifiers) {
    if (
      held.alt !== this.held.alt ||
      held.shift !== this.held.shift ||
      held.ctrlOrCmd !== this.held.ctrlOrCmd
    ) {
      this.held = held;
      this.onChange.trigger(held);
    }
  }
}
