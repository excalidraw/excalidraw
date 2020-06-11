import { getClientShortName } from "../clients";

describe("getClientShortName", () => {
  it("returns substring if one name provided", () => {
    const result = getClientShortName("Alan");
    expect(result).toBe("AL");
  });

  it("returns initials", () => {
    const result = getClientShortName("John Doe");
    expect(result).toBe("JD");
  });

  it("returns correct initials if many names provided", () => {
    const result = getClientShortName("John Alan Doe");
    expect(result).toBe("JD");
  });

  it("returns single initial if 1 letter provided", () => {
    const result = getClientShortName("z");
    expect(result).toBe("Z");
  });

  it("trims trailing whitespace", () => {
    const result = getClientShortName("  q    ");
    expect(result).toBe("Q");
  });

  it('returns "?" if empty string', () => {
    const result = getClientShortName("");
    expect(result).toBe("?");
  });

  it('returns "?" if undefined', () => {
    const result = getClientShortName(undefined);
    expect(result).toBe("Q");
  });
});
