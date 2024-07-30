// vitest.setup.ts
import "vitest-canvas-mock";
import "@testing-library/jest-dom";
import fs from "fs";
import { vi } from "vitest";
import polyfill from "./packages/excalidraw/polyfill";
import { testPolyfills } from "./packages/excalidraw/tests/helpers/polyfills";

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

    constructor(family, source, descriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = "unloaded";
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

vi.mock(
  "./packages/excalidraw/fonts/ExcalidrawFont",
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import("./packages/excalidraw/fonts/ExcalidrawFont")
    >();
    const ExcalidrawFontImpl = mod.ExcalidrawFont;

    return {
      ...mod,
      ExcalidrawFont: class extends ExcalidrawFontImpl {
        public async getContent(): Promise<string> {
          const url = this.urls[0];

          if (url.protocol !== "file:") {
            return super.getContent();
          }

          // read local assets directly, without running a server
          const content = await fs.promises.readFile(url);
          return `data:font/woff2;base64,${content.toString("base64")}`;
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
