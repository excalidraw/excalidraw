import { APP_NAME } from "@excalidraw/common";

import { DEFAULT_DOCUMENT_TITLE, getDocumentTitle } from "../documentTitle";

describe("getDocumentTitle", () => {
  it("falls back to the default title when the drawing has no name", () => {
    expect(getDocumentTitle(null)).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(getDocumentTitle(undefined)).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(getDocumentTitle("")).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(getDocumentTitle("   ")).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("matches the static title in index.html", () => {
    expect(DEFAULT_DOCUMENT_TITLE).toBe("Excalidraw Whiteboard");
  });

  it("includes the drawing name so windows can be told apart", () => {
    expect(getDocumentTitle("Roadmap")).toBe(`Roadmap - ${APP_NAME}`);
  });

  it("trims surrounding whitespace from the name", () => {
    expect(getDocumentTitle("  Sprint plan  ")).toBe(
      `Sprint plan - ${APP_NAME}`,
    );
  });
});
