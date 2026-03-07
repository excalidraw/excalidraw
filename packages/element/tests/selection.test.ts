import {
  makeNextSelectedElementIds,
  isSomeElementSelected,
} from "../src/selection";

describe("makeNextSelectedElementIds", () => {
  const _makeNextSelectedElementIds = (
    selectedElementIds: { [id: string]: true },
    prevSelectedElementIds: { [id: string]: true },
    expectUpdated: boolean,
  ) => {
    const ret = makeNextSelectedElementIds(selectedElementIds, {
      selectedElementIds: prevSelectedElementIds,
    });
    expect(ret === selectedElementIds).toBe(expectUpdated);
  };
  it("should return prevState selectedElementIds if no change", () => {
    _makeNextSelectedElementIds({}, {}, false);
    _makeNextSelectedElementIds({ 1: true }, { 1: true }, false);
    _makeNextSelectedElementIds(
      { 1: true, 2: true },
      { 1: true, 2: true },
      false,
    );
  });
  it("should return new selectedElementIds if changed", () => {
    // _makeNextSelectedElementIds({ 1: true }, { 1: false }, true);
    _makeNextSelectedElementIds({ 1: true }, {}, true);
    _makeNextSelectedElementIds({}, { 1: true }, true);
    _makeNextSelectedElementIds({ 1: true }, { 2: true }, true);
    _makeNextSelectedElementIds({ 1: true }, { 1: true, 2: true }, true);
    _makeNextSelectedElementIds(
      { 1: true, 2: true },
      { 1: true, 3: true },
      true,
    );
  });
});

describe("isSomeElementSelected", () => {
  it("should return true if at least one element is selected", () => {
    const elements = [{ id: "1" }, { id: "2" }] as any;
    const appState = { selectedElementIds: { 2: true } as Record<string, true> };
    expect(isSomeElementSelected(elements, appState)).toBe(true);
  });

  it("should return false if no elements are selected", () => {
    const elements = [{ id: "1" }, { id: "2" }] as any;
    const appState = { selectedElementIds: { 3: true } as Record<string, true> };
    expect(isSomeElementSelected(elements, appState)).toBe(false);
  });

  it("should return false if elements array is empty", () => {
    const elements = [] as any;
    const appState = { selectedElementIds: { 1: true } as Record<string, true> };
    expect(isSomeElementSelected(elements, appState)).toBe(false);
  });
});
