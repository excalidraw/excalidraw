import "pepjs";

import {
  render,
  queries,
  RenderResult,
  RenderOptions,
  waitFor,
} from "@testing-library/react";

import * as toolQueries from "./queries/toolQueries";

const customQueries = {
  ...queries,
  ...toolQueries,
};

type TestRenderFn = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "queries">,
) => Promise<RenderResult<typeof customQueries>>;

const renderApp: TestRenderFn = async (ui, options) => {
  const renderResult = render(ui, {
    queries: customQueries,
    ...options,
  });

  GlobalTestState.renderResult = renderResult;

  Object.defineProperty(GlobalTestState, "canvas", {
    // must be a getter because at the time of ExcalidrawApp render the
    //  child App component isn't likely mounted yet (and thus canvas not
    //  present in DOM)
    get() {
      return renderResult.container.querySelector("canvas")!;
    },
  });

  await waitFor(() => {
    const canvas = renderResult.container.querySelector("canvas");
    if (!canvas) {
      throw new Error("not initialized yet");
    }
  });

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
   * retrieves canvas for currently rendered app instance
   */
  static get canvas(): HTMLCanvasElement {
    return null!;
  }
}
