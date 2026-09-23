import { getDefaultAppState } from "../appState";

import { serializeAsJSON } from "./json";

describe("serializeAsJSON", () => {
  it("attaches a URL reference to the official Excalidraw brand icon", () => {
    const serialized = serializeAsJSON([], getDefaultAppState(), {}, "local");
    const parsed = JSON.parse(serialized);

    expect(parsed.icon).toBe(`${window.location.origin}/favicon.svg`);
  });

  it("still attaches the icon reference for the database export variant", () => {
    const serialized = serializeAsJSON(
      [],
      getDefaultAppState(),
      {},
      "database",
    );
    const parsed = JSON.parse(serialized);

    expect(parsed.icon).toBe(`${window.location.origin}/favicon.svg`);
  });

  it("points to a favicon.svg path, not an arbitrary asset", () => {
    const serialized = serializeAsJSON([], getDefaultAppState(), {}, "local");
    const parsed = JSON.parse(serialized);

    expect(parsed.icon).toMatch(/\/favicon\.svg$/);
  });
});
