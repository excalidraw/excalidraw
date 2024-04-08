// vitest.setup.ts
import "vitest-canvas-mock";
import "@testing-library/jest-dom";
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
