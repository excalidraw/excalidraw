import "pepjs";
import { act } from "@testing-library/react";
import {
  render,
  queries,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import ansi from "ansicolor";

import { ORIG_ID, arrayToMap } from "@excalidraw/common";

import { getSelectedElements } from "@excalidraw/element/selection";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AllPossibleKeys } from "@excalidraw/common/utility-types";

import { STORAGE_KEYS } from "../../../excalidraw-app/app_constants";

import { UI } from "./helpers/ui";
import * as toolQueries from "./queries/toolQueries";

import type { RenderResult, RenderOptions } from "@testing-library/react";

import type { ImportedDataState } from "../data/types";

export { cleanup as unmountComponent };

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

export const getCloneByOrigId = <T extends boolean = false>(
  origId: ExcalidrawElement["id"],
  returnNullIfNotExists: T = false as T,
): T extends true ? ExcalidrawElement | null : ExcalidrawElement => {
  const clonedElement = window.h.elements?.find(
    (el) => (el as any)[ORIG_ID] === origId,
  );
  if (clonedElement) {
    return clonedElement;
  }
  if (returnNullIfNotExists !== true) {
    throw new Error(`cloned element not found for origId: ${origId}`);
  }
  return null as T extends true ? ExcalidrawElement | null : ExcalidrawElement;
};

/**
 * Assertion helper that strips the actual elements of extra attributes
 * so that diffs are easier to read in case of failure.
 *
 * Asserts element order as well, and selected element ids
 * (when `selected: true` set for given element).
 *
 * If testing cloned elements, you can use { `[ORIG_ID]: origElement.id }
 * If you need to refer to cloned element properties, you can use
 * `getCloneByOrigId()`, e.g.: `{ frameId: getCloneByOrigId(origFrame.id)?.id }`
 */
export const assertElements = <T extends AllPossibleKeys<ExcalidrawElement>>(
  actualElements: readonly ExcalidrawElement[],
  /** array order matters */
  expectedElements: (Partial<Record<T, any>> & {
    /** meta, will be stripped for element attribute checks */
    selected?: true;
  } & (
      | {
          id: ExcalidrawElement["id"];
        }
      | { [ORIG_ID]?: string }
    ))[],
) => {
  const h = window.h;

  const expectedElementsWithIds: (typeof expectedElements[number] & {
    id: ExcalidrawElement["id"];
  })[] = expectedElements.map((el) => {
    if ("id" in el) {
      return el;
    }
    const actualElement = actualElements.find(
      (act) => (act as any)[ORIG_ID] === el[ORIG_ID],
    );
    if (actualElement) {
      return { ...el, id: actualElement.id };
    }
    return {
      ...el,
      id: "UNKNOWN_ID",
    };
  });

  const map_expectedElements = arrayToMap(expectedElementsWithIds);

  const selectedElementIds = expectedElementsWithIds.reduce(
    (acc: Record<ExcalidrawElement["id"], true>, el) => {
      if (el.selected) {
        acc[el.id] = true;
      }
      return acc;
    },
    {},
  );

  const mappedActualElements = actualElements.map((el) => {
    const expectedElement = map_expectedElements.get(el.id);
    if (expectedElement) {
      const pickedAttrs: Record<string, any> = {};

      for (const key of Object.keys(expectedElement)) {
        if (key === "selected") {
          delete expectedElement.selected;
          continue;
        }
        pickedAttrs[key] = (el as any)[key];
      }

      if (ORIG_ID in expectedElement) {
        // @ts-ignore
        pickedAttrs[ORIG_ID] = (el as any)[ORIG_ID];
      }

      return pickedAttrs;
    }
    return el;
  });

  try {
    // testing order separately for even easier diffs
    expect(actualElements.map((x) => x.id)).toEqual(
      expectedElementsWithIds.map((x) => x.id),
    );
  } catch (err: any) {
    let errStr = "\n\nmismatched element order\n\n";

    errStr += `actual:   ${ansi.lightGray(
      `[${err.actual
        .map((id: string, index: number) => {
          const act = actualElements[index];

          return `${
            id === err.expected[index] ? ansi.green(id) : ansi.red(id)
          } (${act.type.slice(0, 4)}${
            ORIG_ID in act ? ` ↳ ${(act as any)[ORIG_ID]}` : ""
          })`;
        })
        .join(", ")}]`,
    )}\n${ansi.lightGray(
      `expected: [${err.expected
        .map((exp: string, index: number) => {
          const expEl = actualElements.find((el) => el.id === exp);
          const origEl =
            expEl &&
            actualElements.find((el) => el.id === (expEl as any)[ORIG_ID]);
          return expEl
            ? `${
                exp === err.actual[index]
                  ? ansi.green(expEl.id)
                  : ansi.red(expEl.id)
              } (${expEl.type.slice(0, 4)}${origEl ? ` ↳ ${origEl.id}` : ""})`
            : exp;
        })
        .join(", ")}]\n`,
    )}`;

    const error = new Error(errStr);
    const stack = err.stack.split("\n");
    stack.splice(1, 1);
    error.stack = stack.join("\n");
    throw error;
  }

  expect(mappedActualElements).toEqual(
    expect.arrayContaining(expectedElementsWithIds),
  );

  expect(h.state.selectedElementIds).toEqual(selectedElementIds);
};
