import { APP_NAME } from "@excalidraw/common";

import { getDocumentTitle } from "../appTitle";

describe("app title", () => {
  it("uses the scene name in the document title", () => {
    expect(getDocumentTitle("Project plan")).toBe(`Project plan - ${APP_NAME}`);
  });

  it("falls back to the app name for blank scene names", () => {
    expect(getDocumentTitle(" ")).toBe(APP_NAME);
  });
});
