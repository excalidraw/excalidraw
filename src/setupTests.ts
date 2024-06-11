// vitest.setup.ts
import "vitest-canvas-mock";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import polyfill from "./polyfill";
import { testPolyfills } from "./tests/helpers/polyfills";

Object.assign(globalThis, testPolyfills);

require("fake-indexeddb/auto");

polyfill();

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
