// State and error helpers shared by the test helpers. A leaf module so the
// helpers (helpers/api, helpers/ui, queries/dom) don't import test-utils, which
// imports them.

import type { RenderResult } from "@testing-library/react";

import type { customQueries } from "./test-utils";

/**
 * For state-sharing across test helpers.
 * NOTE: there shouldn't be concurrency issues as each test is running in its
 *  own process and thus gets its own instance of this module when running
 *  tests in parallel.
 */
export class GlobalTestState {
  /**
   * automatically updated on each call to render()
   */
  static renderResult: RenderResult<typeof customQueries> = null!;
  /**
   * retrieves static canvas for currently rendered app instance
   */
  static get canvas(): HTMLCanvasElement {
    return null!;
  }
  /**
   * retrieves interactive canvas for currently rendered app instance
   */
  static get interactiveCanvas(): HTMLCanvasElement {
    return null!;
  }
}

/**
 * removes one or more leading stack trace lines (leading to files) from the
 * error stack trace
 */
export const trimErrorStack = (error: Error, range = 1) => {
  const stack = error.stack?.split("\n");
  if (stack) {
    stack.splice(1, range);
    error.stack = stack.join("\n");
  }
  return error;
};

export const stripIgnoredNodesFromErrorMessage = (error: Error) => {
  error.message = error.message.replace(/\s+Ignored nodes:[\s\S]+/, "");
  return error;
};
