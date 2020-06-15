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

const renderApp: TestRenderFn = (ui, options) =>
  render(ui, {
    queries: customQueries,
    ...options,
  });

// re-export everything
export * from "@testing-library/react";

// override render method
export { renderApp as render };
