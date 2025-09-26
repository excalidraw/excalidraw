import { average } from "@excalidraw/math";

import type {
  ExcalidrawBindableElement,
  FontFamilyValues,
  FontString,
} from "@excalidraw/element/types";

import type {
  ActiveTool,
  AppState,
  ToolType,
  UnsubscribeCallback,
  Zoom,
} from "@excalidraw/excalidraw/types";

import { COLOR_PALETTE } from "./colors";
import {
  DEFAULT_VERSION,
  ENV,
  FONT_FAMILY,
  getFontFamilyFallbacks,
  isDarwin,
  isAndroid,
  isIOS,
  WINDOWS_EMOJI_FALLBACK_FONT,
} from "./constants";

import type { MaybePromise, ResolutionType } from "./utility-types";

import type { EVENT } from "./constants";

let mockDateTime: string | null = null;

export const setDateTimeForTests = (dateTime: string) => {
  mockDateTime = dateTime;
};

export const getDateTime = () => {
  if (mockDateTime) {
    return mockDateTime;
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hr = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}-${hr}${min}`;
};

export const capitalizeString = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const isToolIcon = (
  target: Element | EventTarget | null,
): target is HTMLElement =>
  target instanceof HTMLElement && target.className.includes("ToolIcon");

export const isInputLike = (
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLBRElement
  | HTMLDivElement =>
  (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
  target instanceof HTMLBRElement || // newline in wysiwyg
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

export const isInteractive = (target: Element | EventTarget | null) => {
  return (
    isInputLike(target) ||
    (target instanceof Element && !!target.closest("label, button"))
  );
};

export const isWritableElement = (
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLBRElement
  | HTMLDivElement =>
  (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
  target instanceof HTMLBRElement || // newline in wysiwyg
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement &&
    (target.type === "text" ||
      target.type === "number" ||
      target.type === "password"));

export const getFontFamilyString = ({
  fontFamily,
}: {
  fontFamily: FontFamilyValues;
}) => {
  for (const [fontFamilyString, id] of Object.entries(FONT_FAMILY)) {
    if (id === fontFamily) {
      return `${fontFamilyString}${getFontFamilyFallbacks(id)
        .map((x) => `, ${x}`)
        .join("")}`;
    }
  }
  return WINDOWS_EMOJI_FALLBACK_FONT;
};

/** returns fontSize+fontFamily string for assignment to DOM elements */
export const getFontString = ({
  fontSize,
  fontFamily,
}: {
  fontSize: number;
  fontFamily: FontFamilyValues;
}) => {
  return `${fontSize}px ${getFontFamilyString({ fontFamily })}` as FontString;
};

export const debounce = <T extends any[]>(
  fn: (...args: T) => void,
  timeout: number,
) => {
  let handle = 0;
  let lastArgs: T | null = null;
  const ret = (...args: T) => {
    lastArgs = args;
    clearTimeout(handle);
    handle = window.setTimeout(() => {
      lastArgs = null;
      fn(...args);
    }, timeout);
  };
  ret.flush = () => {
    clearTimeout(handle);
    if (lastArgs) {
      const _lastArgs = lastArgs;
      lastArgs = null;
      fn(..._lastArgs);
    }
  };
  ret.cancel = () => {
    lastArgs = null;
    clearTimeout(handle);
  };
  return ret;
};

// throttle callback to execute once per animation frame
export const throttleRAF = <T extends any[]>(
  fn: (...args: T) => void,
  opts?: { trailing?: boolean },
) => {
  let timerId: number | null = null;
  let lastArgs: T | null = null;
  let lastArgsTrailing: T | null = null;

  const scheduleFunc = (args: T) => {
    timerId = window.requestAnimationFrame(() => {
      timerId = null;
      fn(...args);
      lastArgs = null;
      if (lastArgsTrailing) {
        lastArgs = lastArgsTrailing;
        lastArgsTrailing = null;
        scheduleFunc(lastArgs);
      }
    });
  };

  const ret = (...args: T) => {
    if (isTestEnv()) {
      fn(...args);
      return;
    }
    lastArgs = args;
    if (timerId === null) {
      scheduleFunc(lastArgs);
    } else if (opts?.trailing) {
      lastArgsTrailing = args;
    }
  };
  ret.flush = () => {
    if (timerId !== null) {
      cancelAnimationFrame(timerId);
      timerId = null;
    }
    if (lastArgs) {
      fn(...(lastArgsTrailing || lastArgs));
      lastArgs = lastArgsTrailing = null;
    }
  };
  ret.cancel = () => {
    lastArgs = lastArgsTrailing = null;
    if (timerId !== null) {
      cancelAnimationFrame(timerId);
      timerId = null;
    }
  };
  return ret;
};

/**
 * Exponential ease-out method
 *
 * @param {number} k - The value to be tweened.
 * @returns {number} The tweened value.
 */
export const easeOut = (k: number) => {
  return 1 - Math.pow(1 - k, 4);
};

const easeOutInterpolate = (from: number, to: number, progress: number) => {
  return (to - from) * easeOut(progress) + from;
};

/**
 * Animates values from `fromValues` to `toValues` using the requestAnimationFrame API.
 * Executes the `onStep` callback on each step with the interpolated values.
 * Returns a function that can be called to cancel the animation.
 *
 * @example
 * // Example usage:
 * const fromValues = { x: 0, y: 0 };
 * const toValues = { x: 100, y: 200 };
 * const onStep = ({x, y}) => {
 *   setState(x, y)
 * };
 * const onCancel = () => {
 *   console.log("Animation canceled");
 * };
 *
 * const cancelAnimation = easeToValuesRAF({
 *   fromValues,
 *   toValues,
 *   onStep,
 *   onCancel,
 * });
 *
 * // To cancel the animation:
 * cancelAnimation();
 */
export const easeToValuesRAF = <
  T extends Record<keyof T, number>,
  K extends keyof T,
>({
  fromValues,
  toValues,
  onStep,
  duration = 250,
  interpolateValue,
  onStart,
  onEnd,
  onCancel,
}: {
  fromValues: T;
  toValues: T;
  /**
   * Interpolate a single value.
   * Return undefined to be handled by the default interpolator.
   */
  interpolateValue?: (
    fromValue: number,
    toValue: number,
    /** no easing applied  */
    progress: number,
    key: K,
  ) => number | undefined;
  onStep: (values: T) => void;
  duration?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onCancel?: () => void;
}) => {
  let canceled = false;
  let frameId = 0;
  let startTime: number;

  function step(timestamp: number) {
    if (canceled) {
      return;
    }
    if (startTime === undefined) {
      startTime = timestamp;
      onStart?.();
    }

    const elapsed = Math.min(timestamp - startTime, duration);
    const factor = easeOut(elapsed / duration);

    const newValues = {} as T;

    Object.keys(fromValues).forEach((key) => {
      const _key = key as keyof T;
      const result = ((toValues[_key] - fromValues[_key]) * factor +
        fromValues[_key]) as T[keyof T];
      newValues[_key] = result;
    });

    onStep(newValues);

    if (elapsed < duration) {
      const progress = elapsed / duration;

      const newValues = {} as T;

      Object.keys(fromValues).forEach((key) => {
        const _key = key as K;
        const startValue = fromValues[_key];
        const endValue = toValues[_key];

        let result;

        result = interpolateValue
          ? interpolateValue(startValue, endValue, progress, _key)
          : easeOutInterpolate(startValue, endValue, progress);

        if (result == null) {
          result = easeOutInterpolate(startValue, endValue, progress);
        }

        newValues[_key] = result as T[K];
      });
      onStep(newValues);

      frameId = window.requestAnimationFrame(step);
    } else {
      onStep(toValues);
      onEnd?.();
    }
  }

  frameId = window.requestAnimationFrame(step);

  return () => {
    onCancel?.();
    canceled = true;
    window.cancelAnimationFrame(frameId);
  };
};

// https://github.com/lodash/lodash/blob/es/chunk.js
export const chunk = <T extends any>(
  array: readonly T[],
  size: number,
): T[][] => {
  if (!array.length || size < 1) {
    return [];
  }
  let index = 0;
  let resIndex = 0;
  const result = Array(Math.ceil(array.length / size));
  while (index < array.length) {
    result[resIndex++] = array.slice(index, (index += size));
  }
  return result;
};

export const selectNode = (node: Element) => {
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

export const removeSelection = () => {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
};

export const distance = (x: number, y: number) => Math.abs(x - y);

export const updateActiveTool = (
  appState: Pick<AppState, "activeTool">,
  data: ((
    | {
        type: ToolType;
      }
    | { type: "custom"; customType: string }
  ) & { locked?: boolean; fromSelection?: boolean }) & {
    lastActiveToolBeforeEraser?: ActiveTool | null;
  },
): AppState["activeTool"] => {
  if (data.type === "custom") {
    return {
      ...appState.activeTool,
      type: "custom",
      customType: data.customType,
      locked: data.locked ?? appState.activeTool.locked,
    };
  }

  return {
    ...appState.activeTool,
    lastActiveTool:
      data.lastActiveToolBeforeEraser === undefined
        ? appState.activeTool.lastActiveTool
        : data.lastActiveToolBeforeEraser,
    type: data.type,
    customType: null,
    locked: data.locked ?? appState.activeTool.locked,
    fromSelection: data.fromSelection ?? false,
  };
};

export const isFullScreen = () =>
  document.fullscreenElement?.nodeName === "HTML";

export const allowFullScreen = () =>
  document.documentElement.requestFullscreen();

export const exitFullScreen = () => document.exitFullscreen();

export const getShortcutKey = (shortcut: string): string => {
  shortcut = shortcut
    .replace(/\bAlt\b/i, "Alt")
    .replace(/\bShift\b/i, "Shift")
    .replace(/\b(Enter|Return)\b/i, "Enter");
  if (isDarwin) {
    return shortcut
      .replace(/\bCtrlOrCmd\b/gi, "Cmd")
      .replace(/\bAlt\b/i, "Option");
  }
  return shortcut.replace(/\bCtrlOrCmd\b/gi, "Ctrl");
};

export const viewportCoordsToSceneCoords = (
  { clientX, clientY }: { clientX: number; clientY: number },
  {
    zoom,
    offsetLeft,
    offsetTop,
    scrollX,
    scrollY,
  }: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
) => {
  const x = (clientX - offsetLeft) / zoom.value - scrollX;
  const y = (clientY - offsetTop) / zoom.value - scrollY;

  return { x, y };
};

export const sceneCoordsToViewportCoords = (
  { sceneX, sceneY }: { sceneX: number; sceneY: number },
  {
    zoom,
    offsetLeft,
    offsetTop,
    scrollX,
    scrollY,
  }: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
) => {
  const x = (sceneX + scrollX) * zoom.value + offsetLeft;
  const y = (sceneY + scrollY) * zoom.value + offsetTop;
  return { x, y };
};

export const getGlobalCSSVariable = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${name}`);

const RS_LTR_CHARS =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF" +
  "\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF";
const RS_RTL_CHARS = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
const RE_RTL_CHECK = new RegExp(`^[^${RS_LTR_CHARS}]*[${RS_RTL_CHARS}]`);
/**
 * Checks whether first directional character is RTL. Meaning whether it starts
 *  with RTL characters, or indeterminate (numbers etc.) characters followed by
 *  RTL.
 * See https://github.com/excalidraw/excalidraw/pull/1722#discussion_r436340171
 */
export const isRTL = (text: string) => RE_RTL_CHECK.test(text);

export const tupleToCoors = (
  xyTuple: readonly [number, number],
): { x: number; y: number } => {
  const [x, y] = xyTuple;
  return { x, y };
};

/** use as a rejectionHandler to mute filesystem Abort errors */
export const muteFSAbortError = (error?: Error) => {
  if (error?.name === "AbortError") {
    console.warn(error);
    return;
  }
  throw error;
};

export const findIndex = <T>(
  array: readonly T[],
  cb: (element: T, index: number, array: readonly T[]) => boolean,
  fromIndex: number = 0,
) => {
  if (fromIndex < 0) {
    fromIndex = array.length + fromIndex;
  }
  fromIndex = Math.min(array.length, Math.max(fromIndex, 0));
  let index = fromIndex - 1;
  while (++index < array.length) {
    if (cb(array[index], index, array)) {
      return index;
    }
  }
  return -1;
};

export const findLastIndex = <T>(
  array: readonly T[],
  cb: (element: T, index: number, array: readonly T[]) => boolean,
  fromIndex: number = array.length - 1,
) => {
  if (fromIndex < 0) {
    fromIndex = array.length + fromIndex;
  }
  fromIndex = Math.min(array.length - 1, Math.max(fromIndex, 0));
  let index = fromIndex + 1;
  while (--index > -1) {
    if (cb(array[index], index, array)) {
      return index;
    }
  }
  return -1;
};

/** returns the first non-null mapped value */
export const mapFind = <T, K>(
  collection: readonly T[],
  iteratee: (value: T, index: number) => K | undefined | null,
): K | undefined => {
  for (let idx = 0; idx < collection.length; idx++) {
    const result = iteratee(collection[idx], idx);
    if (result != null) {
      return result;
    }
  }
  return undefined;
};

export const isTransparent = (color: string) => {
  const isRGBTransparent = color.length === 5 && color.substr(4, 1) === "0";
  const isRRGGBBTransparent = color.length === 9 && color.substr(7, 2) === "00";
  return (
    isRGBTransparent ||
    isRRGGBBTransparent ||
    color === COLOR_PALETTE.transparent
  );
};

export const isBindingFallthroughEnabled = (el: ExcalidrawBindableElement) =>
  el.fillStyle !== "solid" || isTransparent(el.backgroundColor);

export type ResolvablePromise<T> = Promise<T> & {
  resolve: [T] extends [undefined]
    ? (value?: MaybePromise<Awaited<T>>) => void
    : (value: MaybePromise<Awaited<T>>) => void;
  reject: (error: Error) => void;
};
export const resolvablePromise = <T>() => {
  let resolve!: any;
  let reject!: any;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (promise as any).resolve = resolve;
  (promise as any).reject = reject;
  return promise as ResolvablePromise<T>;
};

//https://stackoverflow.com/a/9462382/8418
export const nFormatter = (num: number, digits: number): string => {
  const si = [
    { value: 1, symbol: "b" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  let index;
  for (index = si.length - 1; index > 0; index--) {
    if (num >= si[index].value) {
      break;
    }
  }
  return (
    (num / si[index].value).toFixed(digits).replace(rx, "$1") + si[index].symbol
  );
};

export const getVersion = () => {
  return (
    document.querySelector<HTMLMetaElement>('meta[name="version"]')?.content ||
    DEFAULT_VERSION
  );
};

// Adapted from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/emoji.js
export const supportsEmoji = () => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  const offset = 12;
  ctx.fillStyle = "#f00";
  ctx.textBaseline = "top";
  ctx.font = "32px Arial";
  // Modernizr used 🐨, but it is sort of supported on Windows 7.
  // Luckily 😀 isn't supported.
  ctx.fillText("😀", 0, 0);
  return ctx.getImageData(offset, offset, 1, 1).data[0] !== 0;
};

export const getNearestScrollableContainer = (
  element: HTMLElement,
): HTMLElement | Document => {
  let parent = element.parentElement;
  while (parent) {
    if (parent === document.body) {
      return document;
    }
    const { overflowY } = window.getComputedStyle(parent);
    const hasScrollableContent = parent.scrollHeight > parent.clientHeight;
    if (
      hasScrollableContent &&
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay")
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document;
};

export const focusNearestParent = (element: HTMLInputElement) => {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tabIndex > -1) {
      parent.focus();
      return;
    }
    parent = parent.parentElement;
  }
};

export const preventUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  // NOTE: modern browsers no longer allow showing a custom message here
  event.returnValue = "";
};

export const bytesToHexString = (bytes: Uint8Array) => {
  return Array.from(bytes)
    .map((byte) => `0${byte.toString(16)}`.slice(-2))
    .join("");
};

export const getUpdatedTimestamp = () => (isTestEnv() ? 1 : Date.now());

/**
 * Transforms array of objects containing `id` attribute,
 * or array of ids (strings), into a Map, keyd by `id`.
 */
export const arrayToMap = <T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map() as Map<string, T>);
};

export const arrayToMapWithIndex = <T extends { id: string }>(
  elements: readonly T[],
) =>
  elements.reduce((acc, element: T, idx) => {
    acc.set(element.id, [element, idx]);
    return acc;
  }, new Map<string, [element: T, index: number]>());

/**
 * Transform array into an object, use only when array order is irrelevant.
 */
export const arrayToObject = <T>(
  array: readonly T[],
  groupBy?: (value: T) => string | number,
) =>
  array.reduce((acc, value, idx) => {
    acc[groupBy ? groupBy(value) : idx] = value;
    return acc;
  }, {} as { [key: string]: T });

/** Doubly linked node */
export type Node<T> = T & {
  prev: Node<T> | null;
  next: Node<T> | null;
};

/**
 * Creates a circular doubly linked list by adding `prev` and `next` props to the existing array nodes.
 */
export const arrayToList = <T>(array: readonly T[]): Node<T>[] =>
  array.reduce((acc, curr, index) => {
    const node: Node<T> = { ...curr, prev: null, next: null };

    // no-op for first item, we don't want circular references on a single item
    if (index !== 0) {
      const prevNode = acc[index - 1];
      node.prev = prevNode;
      prevNode.next = node;

      if (index === array.length - 1) {
        // make the references circular and connect head & tail
        const firstNode = acc[0];
        node.next = firstNode;
        firstNode.prev = node;
      }
    }

    acc.push(node);

    return acc;
  }, [] as Node<T>[]);

/**
 * Converts a readonly array or map into an iterable.
 * Useful for avoiding entry allocations when iterating object / map on each iteration.
 */
export const toIterable = <T>(
  values: readonly T[] | ReadonlyMap<string, T>,
): Iterable<T> => {
  return Array.isArray(values) ? values : values.values();
};

/**
 * Converts a readonly array or map into an array.
 */
export const toArray = <T>(
  values: readonly T[] | ReadonlyMap<string, T>,
): T[] => {
  return Array.isArray(values) ? values : Array.from(toIterable(values));
};

export const isTestEnv = () => import.meta.env.MODE === ENV.TEST;

export const isDevEnv = () => import.meta.env.MODE === ENV.DEVELOPMENT;

export const isProdEnv = () => import.meta.env.MODE === ENV.PRODUCTION;

export const isServerEnv = () =>
  typeof process !== "undefined" && !!process?.env?.NODE_ENV;

export const wrapEvent = <T extends Event>(name: EVENT, nativeEvent: T) => {
  return new CustomEvent(name, {
    detail: {
      nativeEvent,
    },
    cancelable: true,
  });
};

export const updateObject = <T extends Record<string, any>>(
  obj: T,
  updates: Partial<T>,
): T => {
  let didChange = false;
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (obj as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== "object" || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange) {
    return obj;
  }

  return {
    ...obj,
    ...updates,
  };
};

export const isPrimitive = (val: any) => {
  const type = typeof val;
  return val == null || (type !== "object" && type !== "function");
};

export const getFrame = () => {
  try {
    return window.self === window.top ? "top" : "iframe";
  } catch (error) {
    return "iframe";
  }
};

export const isRunningInIframe = () => getFrame() === "iframe";

export const isPromiseLike = (
  value: any,
): value is Promise<ResolutionType<typeof value>> => {
  return (
    !!value &&
    typeof value === "object" &&
    "then" in value &&
    "catch" in value &&
    "finally" in value
  );
};

export const queryFocusableElements = (container: HTMLElement | null) => {
  const focusableElements = container?.querySelectorAll<HTMLElement>(
    "button, a, input, select, textarea, div[tabindex], label[tabindex]",
  );

  return focusableElements
    ? Array.from(focusableElements).filter(
        (element) =>
          element.tabIndex > -1 && !(element as HTMLInputElement).disabled,
      )
    : [];
};

/** use as a fallback after identity check (for perf reasons) */
const _defaultIsShallowComparatorFallback = (a: any, b: any): boolean => {
  // consider two empty arrays equal
  if (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === 0 &&
    b.length === 0
  ) {
    return true;
  }
  return a === b;
};

/**
 * Returns whether object/array is shallow equal.
 * Considers empty object/arrays as equal (whether top-level or second-level).
 */
export const isShallowEqual = <
  T extends Record<string, any>,
  K extends readonly unknown[],
>(
  objA: T,
  objB: T,
  comparators?:
    | { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    | (keyof T extends K[number]
        ? K extends readonly (keyof T)[]
          ? K
          : {
              _error: "keys are either missing or include keys not in compared obj";
            }
        : {
            _error: "keys are either missing or include keys not in compared obj";
          }),
  debug = false,
) => {
  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  if (aKeys.length !== bKeys.length) {
    if (debug) {
      console.warn(
        `%cisShallowEqual: objects don't have same properties ->`,
        "color: #8B4000",
        objA,
        objB,
      );
    }
    return false;
  }

  if (comparators && Array.isArray(comparators)) {
    for (const key of comparators) {
      const ret =
        objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);
      if (!ret) {
        if (debug) {
          console.warn(
            `%cisShallowEqual: ${key} not equal ->`,
            "color: #8B4000",
            objA[key],
            objB[key],
          );
        }
        return false;
      }
    }
    return true;
  }

  return aKeys.every((key) => {
    const comparator = (
      comparators as { [key in keyof T]?: (a: T[key], b: T[key]) => boolean }
    )?.[key as keyof T];
    const ret = comparator
      ? comparator(objA[key], objB[key])
      : objA[key] === objB[key] ||
        _defaultIsShallowComparatorFallback(objA[key], objB[key]);

    if (!ret && debug) {
      console.warn(
        `%cisShallowEqual: ${key} not equal ->`,
        "color: #8B4000",
        objA[key],
        objB[key],
      );
    }
    return ret;
  });
};

// taken from Radix UI
// https://github.com/radix-ui/primitives/blob/main/packages/core/primitive/src/primitive.tsx
export const composeEventHandlers = <E>(
  originalEventHandler?: (event: E) => void,
  ourEventHandler?: (event: E) => void,
  { checkForDefaultPrevented = true } = {},
) => {
  return function handleEvent(event: E) {
    originalEventHandler?.(event);

    if (
      !checkForDefaultPrevented ||
      !(event as unknown as Event)?.defaultPrevented
    ) {
      return ourEventHandler?.(event);
    }
  };
};

/**
 * supply `null` as message if non-never value is valid, you just need to
 * typecheck against it
 */
export const assertNever = (
  value: never,
  message: string | null,
  softAssert?: boolean,
): never => {
  if (!message) {
    return value;
  }
  if (softAssert) {
    console.error(message);
    return value;
  }

  throw new Error(message);
};

export function invariant(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Memoizes on values of `opts` object (strict equality).
 */
export const memoize = <T extends Record<string, any>, R extends any>(
  func: (opts: T) => R,
) => {
  let lastArgs: Map<string, any> | undefined;
  let lastResult: R | undefined;

  const ret = function (opts: T) {
    const currentArgs = Object.entries(opts);

    if (lastArgs) {
      let argsAreEqual = true;
      for (const [key, value] of currentArgs) {
        if (lastArgs.get(key) !== value) {
          argsAreEqual = false;
          break;
        }
      }
      if (argsAreEqual) {
        return lastResult;
      }
    }

    const result = func(opts);

    lastArgs = new Map(currentArgs);
    lastResult = result;

    return result;
  };

  ret.clear = () => {
    lastArgs = undefined;
    lastResult = undefined;
  };

  return ret as typeof func & { clear: () => void };
};

/** Checks if value is inside given collection. Useful for type-safety. */
export const isMemberOf = <T extends string>(
  /** Set/Map/Array/Object */
  collection: Set<T> | readonly T[] | Record<T, any> | Map<T, any>,
  /** value to look for */
  value: string,
): value is T => {
  return collection instanceof Set || collection instanceof Map
    ? collection.has(value as T)
    : "includes" in collection
    ? collection.includes(value as T)
    : collection.hasOwnProperty(value);
};

export const cloneJSON = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const updateStable = <T extends any[] | Record<string, any>>(
  prevValue: T,
  nextValue: T,
) => {
  if (isShallowEqual(prevValue, nextValue)) {
    return prevValue;
  }
  return nextValue;
};

// Window
export function addEventListener<K extends keyof WindowEventMap>(
  target: Window & typeof globalThis,
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
export function addEventListener(
  target: Window & typeof globalThis,
  type: string,
  listener: (this: Window, ev: Event) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
// Document
export function addEventListener<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
export function addEventListener(
  target: Document,
  type: string,
  listener: (this: Document, ev: Event) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
// FontFaceSet (document.fonts)
export function addEventListener<K extends keyof FontFaceSetEventMap>(
  target: FontFaceSet,
  type: K,
  listener: (this: FontFaceSet, ev: FontFaceSetEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
// HTMLElement / mix
export function addEventListener<K extends keyof HTMLElementEventMap>(
  target:
    | Document
    | (Window & typeof globalThis)
    | HTMLElement
    | undefined
    | null
    | false,
  type: K,
  listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback;
// implem
export function addEventListener(
  /**
   * allows for falsy values so you don't have to type check when adding
   * event listeners to optional elements
   */
  target:
    | Document
    | (Window & typeof globalThis)
    | FontFaceSet
    | HTMLElement
    | undefined
    | null
    | false,
  type: keyof WindowEventMap | keyof DocumentEventMap | string,
  listener: (ev: Event) => any,
  options?: boolean | AddEventListenerOptions,
): UnsubscribeCallback {
  if (!target) {
    return () => {};
  }
  target?.addEventListener?.(type, listener, options);
  return () => {
    target?.removeEventListener?.(type, listener, options);
  };
}

export function getSvgPathFromStroke(points: number[][], closed = true) {
  const len = points.length;

  if (len < 4) {
    return ``;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2,
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1],
  ).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2,
    )} `;
  }

  if (closed) {
    result += "Z";
  }

  return result;
}

export const normalizeEOL = (str: string) => {
  return str.replace(/\r?\n|\r/g, "\n");
};

// -----------------------------------------------------------------------------
type HasBrand<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [K in keyof T]: K extends `~brand${infer _}` ? true : never;
}[keyof T];

type RemoveAllBrands<T> = HasBrand<T> extends true
  ? {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      [K in keyof T as K extends `~brand~${infer _}` ? never : K]: T[K];
    }
  : never;

// adapted from https://github.com/colinhacks/zod/discussions/1994#discussioncomment-6068940
// currently does not cover all types (e.g. tuples, promises...)
type Unbrand<T> = T extends Map<infer E, infer F>
  ? Map<E, F>
  : T extends Set<infer E>
  ? Set<E>
  : T extends Array<infer E>
  ? Array<E>
  : RemoveAllBrands<T>;

/**
 * Makes type into a branded type, ensuring that value is assignable to
 * the base ubranded type. Optionally you can explicitly supply current value
 * type to combine both (useful for composite branded types. Make sure you
 * compose branded types which are not composite themselves.)
 */
export const toBrandedType = <BrandedType, CurrentType = BrandedType>(
  value: Unbrand<BrandedType>,
) => {
  return value as CurrentType & BrandedType;
};

// -----------------------------------------------------------------------------

// Promise.try, adapted from https://github.com/sindresorhus/p-try
export const promiseTry = async <TValue, TArgs extends unknown[]>(
  fn: (...args: TArgs) => PromiseLike<TValue> | TValue,
  ...args: TArgs
): Promise<TValue> => {
  return new Promise((resolve) => {
    resolve(fn(...args));
  });
};

export const isAnyTrue = (...args: boolean[]): boolean =>
  Math.max(...args.map((arg) => (arg ? 1 : 0))) > 0;

export const safelyParseJSON = (json: string): Record<string, any> | null => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * use when you need to render unsafe string as HTML attribute, but MAKE SURE
 * the attribute is double-quoted when constructing the HTML string
 */
export const escapeDoubleQuotes = (str: string) => {
  return str.replace(/"/g, "&quot;");
};

export const castArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value];

/** hack for Array.isArray type guard not working with readonly value[] */
export const isReadonlyArray = (value?: any): value is readonly any[] => {
  return Array.isArray(value);
};

export const sizeOf = (
  value:
    | readonly unknown[]
    | Readonly<Map<string, unknown>>
    | Readonly<Record<string, unknown>>
    | ReadonlySet<unknown>,
): number => {
  return isReadonlyArray(value)
    ? value.length
    : value instanceof Map || value instanceof Set
    ? value.size
    : Object.keys(value).length;
};

export const reduceToCommonValue = <T, R = T>(
  collection: readonly T[] | ReadonlySet<T>,
  getValue?: (item: T) => R,
): R | null => {
  if (sizeOf(collection) === 0) {
    return null;
  }

  const valueExtractor = getValue || ((item: T) => item as unknown as R);

  let commonValue: R | null = null;

  for (const item of collection) {
    const value = valueExtractor(item);
    if ((commonValue === null || commonValue === value) && value != null) {
      commonValue = value;
    } else {
      return null;
    }
  }

  return commonValue;
};

export const isMobileOrTablet = (): boolean => {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const uaData = (navigator as any).userAgentData as
    | { mobile?: boolean; platform?: string }
    | undefined;

  // --- 1) chromium: prefer ua client hints -------------------------------
  if (uaData) {
    const plat = (uaData.platform || "").toLowerCase();
    const isDesktopOS =
      plat === "windows" ||
      plat === "macos" ||
      plat === "linux" ||
      plat === "chrome os";
    if (uaData.mobile === true) {
      return true;
    }
    if (uaData.mobile === false && plat === "android") {
      const looksTouchTablet =
        matchMedia?.("(hover: none)").matches &&
        matchMedia?.("(pointer: coarse)").matches;
      return looksTouchTablet;
    }
    if (isDesktopOS) {
      return false;
    }
  }

  // --- 2) ios (includes ipad) --------------------------------------------
  if (isIOS) {
    return true;
  }

  // --- 3) android legacy ua fallback -------------------------------------
  if (isAndroid) {
    const isAndroidPhone = /Mobile/i.test(ua);
    const isAndroidTablet = !isAndroidPhone;
    if (isAndroidPhone || isAndroidTablet) {
      const looksTouchTablet =
        matchMedia?.("(hover: none)").matches &&
        matchMedia?.("(pointer: coarse)").matches;
      return looksTouchTablet;
    }
  }

  // --- 4) last resort desktop exclusion ----------------------------------
  const looksDesktopPlatform =
    /Win|Linux|CrOS|Mac/.test(platform) ||
    /Windows NT|X11|CrOS|Macintosh/.test(ua);
  if (looksDesktopPlatform) {
    return false;
  }
  return false;
};
