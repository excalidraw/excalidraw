import fallbackLangData from "./en.json";
import { languages } from "../i18n";
import mongolianLangData from "./mn-MN.json";

const flattenKeys = (data: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(data).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe("Mongolian locale", () => {
  it("matches the English translation keyset", () => {
    expect(flattenKeys(mongolianLangData).sort()).toEqual(
      flattenKeys(fallbackLangData).sort(),
    );
  });

  it("is selectable after meeting the completion threshold", () => {
    expect(languages).toContainEqual({ code: "mn-MN", label: "Монгол" });
  });
});
