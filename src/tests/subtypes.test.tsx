import { Subtype, isValidSubtypeName, prepareSubtype } from "../subtypes";

const test1: Subtype = {
  name: "test",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
};

const test1NonParent = "text" as const;

prepareSubtype(test1);

describe("subtypes", () => {
  it("should correctly validate", async () => {
    test1.parents.forEach((p) => {
      expect(isValidSubtypeName(test1.name, p)).toBe(true);
      expect(isValidSubtypeName(undefined, p)).toBe(false);
    });
    expect(isValidSubtypeName(test1.name, test1NonParent)).toBe(false);
    expect(isValidSubtypeName(test1.name, undefined)).toBe(false);
    expect(isValidSubtypeName(undefined, undefined)).toBe(false);
  });
});
