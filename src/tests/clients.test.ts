import { getClientInitials } from "../clients";

describe("getClientInitials", () => {
  it("returns substring if one name provided", () => {
    const result = getClientInitials("Alan");
    expect(result).toBe("AL");
  });

  it("returns initials", () => {
    const result = getClientInitials("John Doe");
    expect(result).toBe("JD");
  });

  it("returns correct initials if many names provided", () => {
    const result = getClientInitials("John Alan Doe");
    expect(result).toBe("JD");
  });

  it("returns single initial if 1 letter provided", () => {
    const result = getClientInitials("z");
    expect(result).toBe("Z");
  });

  it("trims trailing whitespace", () => {
    const result = getClientInitials("  q    ");
    expect(result).toBe("Q");
  });

  it('returns "?" if empty string', () => {
    const result = getClientInitials("");
    expect(result).toBe("?");
  });

  it('returns "?" if undefined', () => {
    const result = getClientInitials(undefined);
    expect(result).toBe("Q");
  });
});
