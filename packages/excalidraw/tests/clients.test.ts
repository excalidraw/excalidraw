import { getNameInitial } from "../clients";

describe("getClientInitials", () => {
  it("returns substring if one name provided", () => {
    expect(getNameInitial("Alan")).toBe("A");
  });

  it("returns initials", () => {
    expect(getNameInitial("John Doe")).toBe("J");
  });

  it("returns correct initials if many names provided", () => {
    expect(getNameInitial("John Alan Doe")).toBe("J");
  });

  it("returns single initial if 1 letter provided", () => {
    expect(getNameInitial("z")).toBe("Z");
  });

  it("trims trailing whitespace", () => {
    expect(getNameInitial("  q    ")).toBe("Q");
  });

  it('returns "?" if falsey value provided', () => {
    expect(getNameInitial("")).toBe("?");
    expect(getNameInitial(undefined)).toBe("?");
    expect(getNameInitial(null)).toBe("?");
  });

  it('returns "?" when value is blank', () => {
    expect(getNameInitial(" ")).toBe("?");
  });

  it("works with multibyte strings", () => {
    expect(getNameInitial("😀")).toBe("😀");
    // but doesn't work with emoji ZWJ sequences
    expect(getNameInitial("👨‍👩‍👦")).toBe("👨");
  });
});
