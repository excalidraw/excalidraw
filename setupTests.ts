// vitest.setup.ts
import "vitest-canvas-mock";
import "@testing-library/jest-dom";
import fs from "fs";
import { vi } from "vitest";
import polyfill from "./packages/excalidraw/polyfill";
import { testPolyfills } from "./packages/excalidraw/tests/helpers/polyfills";
import { yellow } from "./packages/excalidraw/tests/helpers/colorize";

Object.assign(globalThis, testPolyfills);

require("fake-indexeddb/auto");

polyfill();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "FontFace", {
  enumerable: true,
  value: class {
    private family: string;
    private source: string;
    private descriptors: any;
    private status: string;
    private unicodeRange: string;

    constructor(family, source, descriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = "unloaded";
      this.unicodeRange = "U+0000-00FF";
    }

    load() {
      this.status = "loaded";
    }
  },
});

Object.defineProperty(document, "fonts", {
  value: {
    load: vi.fn().mockResolvedValue([]),
    check: vi.fn().mockResolvedValue(true),
    has: vi.fn().mockResolvedValue(true),
    add: vi.fn(),
  },
});

Object.defineProperty(window, "EXCALIDRAW_ASSET_PATH", {
  value: `file://${__dirname}/`,
});

// mock the font fetch only, so that everything else, as font subsetting, can run inside of the (snapshot) tests
vi.mock(
  "./packages/excalidraw/fonts/ExcalidrawFontFace",
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import("./packages/excalidraw/fonts/ExcalidrawFontFace")
    >();
    const ExcalidrawFontFaceImpl = mod.ExcalidrawFontFace;

    return {
      ...mod,
      ExcalidrawFontFace: class extends ExcalidrawFontFaceImpl {
        public async fetchFont(url: URL): Promise<ArrayBuffer> {
          if (!url.toString().startsWith("file://")) {
            return super.fetchFont(url);
          }

          // read local assets directly, without running a server
          const content = await fs.promises.readFile(url);
          return content.buffer;
        }
      },
    };
  },
);

vi.mock("nanoid", () => {
  return {
    nanoid: vi.fn(() => "test-id"),
  };
});
// ReactDOM is located inside index.tsx file
// as a result, we need a place for it to render into
const element = document.createElement("div");
element.id = "root";
document.body.appendChild(element);

const _consoleError = console.error.bind(console);
console.error = (...args) => {
  // the react's act() warning usually doesn't contain any useful stack trace
  // so we're catching the log and re-logging the message with the test name,
  // also stripping the actual component stack trace as it's not useful
  if (args[0]?.includes?.("act(")) {
    _consoleError(
      yellow(
        `<<< WARNING: test "${
          expect.getState().currentTestName
        }" does not wrap some state update in act() >>>`,
      ),
    );
  } else {
    _consoleError(...args);
  }
};
