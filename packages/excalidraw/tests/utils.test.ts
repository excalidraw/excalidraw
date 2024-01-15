import * as utils from "../utils";

describe("Test isTransparent", () => {
  it("should return true when color is rgb transparent", () => {
    expect(utils.isTransparent("#ff00")).toEqual(true);
    expect(utils.isTransparent("#fff00000")).toEqual(true);
    expect(utils.isTransparent("transparent")).toEqual(true);
  });

  it("should return false when color is not transparent", () => {
    expect(utils.isTransparent("#ced4da")).toEqual(false);
  });
});
