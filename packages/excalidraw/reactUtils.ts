/**
 * @param func handler taking at most single parameter (event).
 */

import { unstable_batchedUpdates } from "react-dom";

import { throttleRAF } from "@excalidraw/common";

export const withBatchedUpdates = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
) =>
  ((event) => {
    unstable_batchedUpdates(func as TFunction, event);
  }) as TFunction;

/**
 * barches React state updates and throttles the calls to a single call per
 * animation frame
 */
export const withBatchedUpdatesThrottled = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
  ownerWindow: Window = window,
) => {
  return throttleRAF<Parameters<TFunction>>(
    // @ts-ignore
    ((event) => {
      unstable_batchedUpdates(func, event);
    }) as TFunction,
    ownerWindow,
  );
};

export const isRenderThrottlingEnabled = () =>
  window.EXCALIDRAW_THROTTLE_RENDER === true;
