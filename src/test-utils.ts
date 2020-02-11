import {
  render,
  queries,
  RenderResult,
  RenderOptions,
} from "@testing-library/react";

type TestRenderFn = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "queries">,
) => RenderResult;

const renderApp: TestRenderFn = (ui, options) =>
  render(ui, { queries: { ...queries }, ...options });

// re-export everything
export * from "@testing-library/react";

// override render method
export { renderApp as render };
