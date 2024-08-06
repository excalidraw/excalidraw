import "pepjs";

import type { RenderResult, RenderOptions } from "@testing-library/react";
import { act } from "@testing-library/react";
import { render, queries, waitFor, fireEvent } from "@testing-library/react";

import * as toolQueries from "./queries/toolQueries";
import type { ImportedDataState } from "../data/types";
import { STORAGE_KEYS } from "../../../excalidraw-app/app_constants";
import { getSelectedElements } from "../scene/selection";
import type { ExcalidrawElement } from "../element/types";
import { UI } from "./helpers/ui";

const customQueries = {
  ...queries,
  ...toolQueries,
};

type TestRenderFn = (
  ui: React.ReactElement,
  options?: Omit<
    RenderOptions & { localStorageData?: ImportedDataState },
    "queries"
  >,
) => Promise<RenderResult<typeof customQueries>>;

const renderApp: TestRenderFn = async (ui, options) => {
  if (options?.localStorageData) {
    initLocalStorage(options.localStorageData);
    delete options.localStorageData;
  }

  const renderResult = render(ui, {
    queries: customQueries,
    ...options,
  });

  GlobalTestState.renderResult = renderResult;

  Object.defineProperty(GlobalTestState, "canvas", {
    // must be a getter because at the time of ExcalidrawApp render the
    // child App component isn't likely mounted yet (and thus canvas not
    // present in DOM)
    get() {
      return renderResult.container.querySelector("canvas.static")!;
    },
  });

  Object.defineProperty(GlobalTestState, "interactiveCanvas", {
    // must be a getter because at the time of ExcalidrawApp render the
    // child App component isn't likely mounted yet (and thus canvas not
    // present in DOM)
    get() {
      return renderResult.container.querySelector("canvas.interactive")!;
    },
  });

  await waitFor(() => {
    const canvas = renderResult.container.querySelector("canvas.static");
    if (!canvas) {
      throw new Error("not initialized yet");
    }

    const interactiveCanvas =
      renderResult.container.querySelector("canvas.interactive");
    if (!interactiveCanvas) {
      throw new Error("not initialized yet");
    }

    // hack-awaiting app.initialScene() which solves some test race conditions
    // (later we may switch this with proper event listener)
    if (window.h.state.isLoading) {
      throw new Error("still loading");
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

const initLocalStorage = (data: ImportedDataState) => {
  if (data.elements) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(data.elements),
    );
  }
  if (data.appState) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(data.appState),
    );
  }
};

const originalGetBoundingClientRect =
  global.window.HTMLDivElement.prototype.getBoundingClientRect;

export const mockBoundingClientRect = (
  {
    top = 0,
    left = 0,
    bottom = 0,
    right = 0,
    width = 1920,
    height = 1080,
    x = 0,
    y = 0,
    toJSON = () => {},
  } = {
    top: 10,
    left: 20,
    bottom: 10,
    right: 10,
    width: 200,
    x: 10,
    y: 20,
    height: 100,
  },
) => {
  // override getBoundingClientRect as by default it will always return all values as 0 even if customized in html
  global.window.HTMLDivElement.prototype.getBoundingClientRect = () => ({
    top,
    left,
    bottom,
    right,
    width,
    height,
    x,
    y,
    toJSON,
  });
};

export const withExcalidrawDimensions = async (
  dimensions: { width: number; height: number },
  cb: () => void,
) => {
  mockBoundingClientRect(dimensions);
  act(() => {
    // @ts-ignore
    h.app.refreshViewportBreakpoints();
    // @ts-ignore
    h.app.refreshEditorBreakpoints();
    window.h.app.refresh();
  });

  await cb();

  restoreOriginalGetBoundingClientRect();
  act(() => {
    // @ts-ignore
    h.app.refreshViewportBreakpoints();
    // @ts-ignore
    h.app.refreshEditorBreakpoints();
    window.h.app.refresh();
  });
};

export const restoreOriginalGetBoundingClientRect = () => {
  global.window.HTMLDivElement.prototype.getBoundingClientRect =
    originalGetBoundingClientRect;
};

export const assertSelectedElements = (
  ...elements: (
    | (ExcalidrawElement["id"] | ExcalidrawElement)[]
    | ExcalidrawElement["id"]
    | ExcalidrawElement
  )[]
) => {
  const { h } = window;
  const selectedElementIds = getSelectedElements(
    h.app.getSceneElements(),
    h.state,
  ).map((el) => el.id);
  const ids = elements
    .flat()
    .map((item) => (typeof item === "string" ? item : item.id));
  expect(selectedElementIds.length).toBe(ids.length);
  expect(selectedElementIds).toEqual(expect.arrayContaining(ids));
};

export const toggleMenu = (container: HTMLElement) => {
  // open menu
  fireEvent.click(container.querySelector(".dropdown-menu-button")!);
};

export const togglePopover = (label: string) => {
  // Needed for radix-ui/react-popover as tests fail due to resize observer not being present
  (global as any).ResizeObserver = class ResizeObserver {
    constructor(cb: any) {
      (this as any).cb = cb;
    }

    observe() {}

    unobserve() {}
    disconnect() {}
  };

  UI.clickLabeledElement(label);
};

expect.extend({
  toBeNonNaNNumber(received) {
    const pass = typeof received === "number" && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a non-NaN number`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be a non-NaN number`,
      pass: false,
    };
  },
});

/**
 * Serializer for IEE754 float pointing numbers to avoid random failures due to tiny precision differences
 */
expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return printer(val.toFixed(5), config, indentation, depth, refs);
  },
  test(val) {
    return (
      typeof val === "number" &&
      Number.isFinite(val) &&
      !Number.isNaN(val) &&
      !Number.isInteger(val)
    );
  },
});
