import { makeNextSelectedElementIds } from "./selection";

describe("makeNextSelectedElementIds", () => {
  const _makeNextSelectedElementIds = (
    selectedElementIds: { [id: string]: boolean },
    prevSelectedElementIds: { [id: string]: boolean },
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
    _makeNextSelectedElementIds({ 1: false }, { 1: false }, false);
    _makeNextSelectedElementIds(
      { 1: false, 2: true },
      { 1: false, 2: true },
      false,
    );
    _makeNextSelectedElementIds({ 1: false }, {}, false);
    _makeNextSelectedElementIds({}, { 1: false }, false);
  });

  it("should return new selectedElementIds if changed", () => {
    _makeNextSelectedElementIds({ 1: true }, { 1: false }, true);
    _makeNextSelectedElementIds({ 1: true }, {}, true);
    _makeNextSelectedElementIds({}, { 1: true }, true);
    _makeNextSelectedElementIds({ 1: true }, { 2: true }, true);
    _makeNextSelectedElementIds({ 1: true }, { 2: false }, true);
    _makeNextSelectedElementIds(
      { 1: true, 2: false },
      { 1: true, 2: true },
      true,
    );
  });
});
