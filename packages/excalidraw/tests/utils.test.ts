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

describe("Test detectTextDirection", () => {
  it.each([
    ["ltr", ""],
    ["ltr", "hello world"],
    ["rtl", "שלום עולם"],
    ["rtl", "مرحبا بالعالم"],
    ["rtl", "مرحبا"],
    ["rtl", "שלום"],
    ["rtl", "עולם"],
    ["rtl", "مرحبا بكم"],
    ["rtl", "أهلا وسهلا"],
    ["rtl", "أهلا"],
    ["rtl", "وسهلا"],
    ["ltr", "hello עולם world עולם"],
  ])("should return %s when text is %s", (expected, text) => {
    expect(utils.detectTextDirection(text)).toEqual(expected);
  });
});
