import { restoreLibraryItems } from "../data/restore";

import { API } from "./helpers/api";

const rect = () => API.createElement({ type: "rectangle" });

const restore = (input: unknown) =>
  restoreLibraryItems(input as any, "published");

describe("restoreLibraryItems with malformed input", () => {
  it("restores a well formed library", () => {
    expect(
      restore([
        { id: "a", status: "published", created: 1, elements: [rect()] },
      ]),
    ).toHaveLength(1);
  });

  it("still migrates the legacy array-of-arrays shape", () => {
    expect(restore([[rect()]])).toHaveLength(1);
  });

  it("returns an empty library when the input is not an array", () => {
    for (const bad of [null, undefined, {}, 0, "", "nope", true]) {
      expect(restore(bad)).toEqual([]);
    }
  });

  it("skips malformed items and keeps the rest", () => {
    const good = {
      id: "a",
      status: "published",
      created: 1,
      elements: [rect()],
    };

    expect(restore([null, good, undefined, 1, "x"])).toHaveLength(1);
  });

  it("skips an item whose elements are missing", () => {
    expect(restore([{ id: "a", status: "published", created: 1 }])).toEqual([]);
  });
});
