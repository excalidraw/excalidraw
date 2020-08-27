import "pepjs";

import {
  render,
  queries,
  RenderResult,
  RenderOptions,
} from "@testing-library/react";

import * as toolQueries from "./queries/toolQueries";

const customQueries = {
  ...queries,
  ...toolQueries,
};

type TestRenderFn = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "queries">,
) => RenderResult<typeof customQueries>;

const renderApp: TestRenderFn = (ui, options) => {
  const renderResult = render(ui, {
    queries: customQueries,
    ...options,
  });

  GlobalTestState.renderResult = renderResult;
  GlobalTestState.canvas = renderResult.container.querySelector("canvas")!;

  return renderResult;
};

// re-export everything
export * from "@testing-library/react";

// override render method
export { renderApp as render };

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
   * automatically updated on each call to render()
   */
  static canvas: HTMLCanvasElement = null!;
}
