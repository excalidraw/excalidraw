import type { EDITOR_LS_KEYS } from "@excalidraw/common";

import type { JSONValue } from "../types";

/**
 * The browser's storage for what the editor keeps itself. An editor mounted
 * in another window than the code runs in passes its own (`app.ownerWindow`).
 */
export class EditorLocalStorage {
  static has(
    key: typeof EDITOR_LS_KEYS[keyof typeof EDITOR_LS_KEYS],
    ownerWindow: Window = window,
  ) {
    try {
      return !!ownerWindow.localStorage.getItem(key);
    } catch (error: any) {
      console.warn(`localStorage.getItem error: ${error.message}`);
      return false;
    }
  }

  static get<T extends JSONValue>(
    key: typeof EDITOR_LS_KEYS[keyof typeof EDITOR_LS_KEYS],
    ownerWindow: Window = window,
  ) {
    try {
      const value = ownerWindow.localStorage.getItem(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error: any) {
      console.warn(`localStorage.getItem error: ${error.message}`);
      return null;
    }
  }

  static set = (
    key: typeof EDITOR_LS_KEYS[keyof typeof EDITOR_LS_KEYS],
    value: JSONValue,
    ownerWindow: Window = window,
  ) => {
    try {
      ownerWindow.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error: any) {
      console.warn(`localStorage.setItem error: ${error.message}`);
      return false;
    }
  };

  static delete = (
    name: typeof EDITOR_LS_KEYS[keyof typeof EDITOR_LS_KEYS],
    ownerWindow: Window = window,
  ) => {
    try {
      ownerWindow.localStorage.removeItem(name);
    } catch (error: any) {
      console.warn(`localStorage.removeItem error: ${error.message}`);
    }
  };
}
