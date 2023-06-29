import { normalizeLink } from "./url";

describe("normalizeLink", () => {
  it("should sanitize links", () => {
    expect(
      // eslint-disable-next-line no-script-url
      normalizeLink(`javascript://%0aalert(document.domain)`).startsWith(
        // eslint-disable-next-line no-script-url
        `javascript:`,
      ),
    ).toBe(false);

    expect(
      normalizeLink("https://www.excalidraw.com").startsWith("https://"),
    ).toBe(true);
  });
});
