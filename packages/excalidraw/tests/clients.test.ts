import { getClientColor, getNameInitial } from "../clients";

import type { SocketId } from "../types";

describe("getClientColor", () => {
  it("returns a stable color for string ids", () => {
    expect(getClientColor("abc" as SocketId, undefined)).toBe(
      "hsl(60, 100%, 83%)",
    );
  });

  it("does not throw for non-string ids", () => {
    const fallback = getClientColor("" as SocketId, undefined);
    for (const id of [null, undefined, 42, ["a"], { length: 1 }, {}]) {
      expect(getClientColor(id as any, undefined)).toBe(fallback);
      expect(() =>
        getClientColor("abc" as SocketId, { id: id as any }),
      ).not.toThrow();
    }
  });
});

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

  it('returns "?" for non-string values', () => {
    expect(getNameInitial(123 as any)).toBe("?");
    expect(getNameInitial({} as any)).toBe("?");
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
