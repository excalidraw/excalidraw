import { SubtypeRecord, isValidSubtype, prepareSubtype } from "../subtypes";

const test1: SubtypeRecord = {
  subtype: "test",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
};

const test1NonParent = "text" as const;

prepareSubtype(test1);

describe("subtypes", () => {
  it("should correctly validate", async () => {
    test1.parents.forEach((p) => {
      expect(isValidSubtype(test1.subtype, p)).toBe(true);
      expect(isValidSubtype(undefined, p)).toBe(false);
    });
    expect(isValidSubtype(test1.subtype, test1NonParent)).toBe(false);
    expect(isValidSubtype(test1.subtype, undefined)).toBe(false);
    expect(isValidSubtype(undefined, undefined)).toBe(false);
  });
});
