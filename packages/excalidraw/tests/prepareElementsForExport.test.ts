/**
 * Tests for prepareElementsForExport (MC/DC cases CT1..CT6)
 *
 * This file mocks ../scene and @excalidraw/element using factory mocks so that
 * exported functions are jest.fn() and can be controlled with .mockReturnValue.
 *
 * Map of CTs:
 * CT1 - exportSelectionOnly = true, selection exists, selectedElements.length > 1
 * CT2 - exportSelectionOnly = true, no selection (isSomeElementSelected = false)
 * CT3 - exportSelectionOnly = false, selection exists
 * CT4 - selectedElements.length === 1 && isFrameLikeElement === true (frame case)
 * CT5 - selectedElements.length === 1 && isFrameLikeElement === false (single non-frame)
 * CT6 - not exporting selection (covers branch exportedElements = elements)
 */

import { vi } from "vitest";
import { prepareElementsForExport } from "../data/index"; // function under test

// Provide factory mocks for modules to guarantee functions are vi.fn()
vi.mock("../scene", () => ({
  isSomeElementSelected: vi.fn(),
  getSelectedElements: vi.fn(),
}));

vi.mock("@excalidraw/element", () => ({
  // minimal set of helpers used by prepareElementsForExport
  isFrameLikeElement: vi.fn(),
  getElementsOverlappingFrame: vi.fn(),
  getNonDeletedElements: vi.fn((els: any[]) => els.filter((e: any) => !e.isDeleted)),
}));

// For cloneJSON we can use real implementation or a simple deep clone
vi.mock("@excalidraw/common", async () => {
  const original = await vi.importActual<typeof import("@excalidraw/common")>("@excalidraw/common");
  return {
    ...original,
    cloneJSON: (v: any) => JSON.parse(JSON.stringify(v)),
  };
});

import * as scene from "../scene";
import * as elementModule from "@excalidraw/element";

// Helper minimal element factory
const makeElement = (overrides: any = {}) => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  type: overrides.type ?? "rectangle",
  isDeleted: overrides.isDeleted ?? false,
  frameId: overrides.frameId ?? null,
  containerId: overrides.containerId ?? null,
  boundElements: overrides.boundElements ?? undefined,
  ...overrides,
});

beforeEach(() => {
  // reset mocks before each test
  vi.mocked(scene.isSomeElementSelected).mockReset();
  vi.mocked(scene.getSelectedElements).mockReset();
  vi.mocked(elementModule.isFrameLikeElement).mockReset();
  vi.mocked(elementModule.getElementsOverlappingFrame).mockReset();
  vi.mocked(elementModule.getNonDeletedElements).mockReset();
  // default behavior for getNonDeletedElements
  vi.mocked(elementModule.getNonDeletedElements).mockImplementation((els: readonly any[]) =>
    els.filter((e: any) => !e.isDeleted) as any,
  );
});

test("CT1 - export selection when flag true and selection exists (A1=1,A2=1; exportedElements.length>1)", () => {
  const el1 = makeElement({ id: "e1" });
  const el2 = makeElement({ id: "e2" });
  const el3 = makeElement({ id: "e3" });
  const elements = [el1, el2, el3];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(true);
  vi.mocked(scene.getSelectedElements).mockReturnValue([el1, el2]);
  vi.mocked(elementModule.isFrameLikeElement).mockReturnValue(false);

  const result = prepareElementsForExport(elements, { selectedElementIds: { e1: true, e2: true } }, true);

  expect(result.exportingFrame).toBeNull();
  expect(result.exportedElements).toHaveLength(2);
  expect(result.exportedElements).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "e1" }), expect.objectContaining({ id: "e2" })]),
  );
});

test("CT2 - exportSelectionOnly true but no selection (A1=1,A2=0)", () => {
  const el1 = makeElement({ id: "e1" });
  const el2 = makeElement({ id: "e2" });
  const elements = [el1, el2];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(false);
  vi.mocked(scene.getSelectedElements).mockReturnValue([]);

  const result = prepareElementsForExport(elements, { selectedElementIds: {} }, true);

  expect(result.exportingFrame).toBeNull();
  expect(result.exportedElements).toHaveLength(elements.length);
  expect(result.exportedElements).toEqual(elements);
});

test("CT3 - exportSelectionOnly false even when selection exists (A1=0,A2=1)", () => {
  const el1 = makeElement({ id: "e1" });
  const el2 = makeElement({ id: "e2" });
  const elements = [el1, el2];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(true);
  vi.mocked(scene.getSelectedElements).mockReturnValue([el1]);

  const result = prepareElementsForExport(elements, { selectedElementIds: { e1: true } }, false);

  expect(result.exportingFrame).toBeNull();
  expect(result.exportedElements).toHaveLength(elements.length);
  expect(result.exportedElements).toEqual(elements);
});

test("CT4 - selection is single frame (B1=1,B2=1)", () => {
  const frame = makeElement({ id: "frame1", type: "frame" });
  const insideA = makeElement({ id: "i1", frameId: "frame1" });
  const insideB = makeElement({ id: "i2", frameId: "frame1" });

  const elements = [frame, insideA, insideB];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(true);
  vi.mocked(scene.getSelectedElements).mockReturnValue([frame]);
  vi.mocked(elementModule.isFrameLikeElement).mockImplementation((el: any) => el.type === "frame");
  vi.mocked(elementModule.getElementsOverlappingFrame).mockReturnValue([insideA, insideB]);

  const result = prepareElementsForExport(elements, { selectedElementIds: { frame1: true } }, true);

  expect(result.exportingFrame).toEqual(expect.objectContaining({ id: "frame1" }));
  expect(result.exportedElements).toEqual(expect.arrayContaining([expect.objectContaining({ id: "i1" }), expect.objectContaining({ id: "i2" })]));
});

test("CT5 - selection single non-frame (B1=1,B2=0)", () => {
  const single = makeElement({ id: "s1", type: "rectangle" });
  const elements = [single];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(true);
  vi.mocked(scene.getSelectedElements).mockReturnValue([single]);
  vi.mocked(elementModule.isFrameLikeElement).mockReturnValue(false);

  const result = prepareElementsForExport(elements, { selectedElementIds: { s1: true } }, true);

  expect(result.exportingFrame).toBeNull();
  expect(result.exportedElements).toHaveLength(1);
  expect(result.exportedElements[0]).toEqual(expect.objectContaining({ id: "s1" }));
});

test("CT6 - not exporting selection returns full list (CD3 false)", () => {
  const a = makeElement({ id: "a" });
  const b = makeElement({ id: "b" });
  const elements = [a, b];

  vi.mocked(scene.isSomeElementSelected).mockReturnValue(false);

  const result = prepareElementsForExport(elements, { selectedElementIds: {} }, false);

  expect(result.exportingFrame).toBeNull();
  expect(result.exportedElements).toHaveLength(2);
  expect(result.exportedElements).toEqual(elements);
});