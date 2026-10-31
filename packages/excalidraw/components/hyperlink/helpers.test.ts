import { describe, expect, it, vi } from "vitest";

import { isPointHittingLink } from "./helpers";

// Mock @excalidraw/element so we can control hit detection without a full canvas
vi.mock("@excalidraw/element", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@excalidraw/element")>();
  return {
    ...actual,
    getElementAbsoluteCoords: vi.fn(() => [0, 0, 100, 100]),
    hitElementBoundingBox: vi.fn(() => true), // always "hit" for simplicity
  };
});

const makeElement = (overrides = {}) =>
  ({
    id: "el1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    link: "https://example.com",
    ...overrides,
  }) as any;

const makeAppState = (overrides = {}) =>
  ({
    zoom: { value: 1 },
    selectedElementIds: {},
    viewModeEnabled: false,
    scrollX: 0,
    scrollY: 0,
    ...overrides,
  }) as any;

describe("isPointHittingLink", () => {
  it("returns false when element has no link", () => {
    const element = makeElement({ link: null });
    const result = isPointHittingLink(
      element,
      new Map(),
      makeAppState({ viewModeEnabled: true }),
      [50, 50] as any,
      true, // isMobile
    );
    expect(result).toBe(false);
  });

  it("returns false when element is selected (popup handles it instead)", () => {
    const element = makeElement();
    const result = isPointHittingLink(
      element,
      new Map(),
      makeAppState({ selectedElementIds: { el1: true }, viewModeEnabled: true }),
      [50, 50] as any,
      true, // isMobile
    );
    expect(result).toBe(false);
  });

  it("returns true on mobile in view mode when tapping element body", () => {
    // Regression test for: mobile hyperlinks not clickable in view/presentation mode.
    // Previously, `!isMobile` guard prevented mobile from using the bounding-box
    // hit area in view mode, requiring users to tap a 12px icon precisely.
    const element = makeElement();
    const result = isPointHittingLink(
      element,
      new Map(),
      makeAppState({ viewModeEnabled: true }),
      [50, 50] as any,
      true, // isMobile = true
    );
    expect(result).toBe(true);
  });

  it("returns true on desktop in view mode when tapping element body", () => {
    const element = makeElement();
    const result = isPointHittingLink(
      element,
      new Map(),
      makeAppState({ viewModeEnabled: true }),
      [50, 50] as any,
      false, // isMobile = false (desktop)
    );
    expect(result).toBe(true);
  });
});
