import { afterEach, describe, expect, it } from "vitest";

import {
  getFavoriteTemplateIds,
  getRecentTemplateIds,
  isFavoriteTemplateId,
  pushRecentTemplateId,
  toggleFavoriteTemplateId,
} from "./shapeTemplatesStorage";

describe("shapeTemplatesStorage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("tracks recent template ids in order", () => {
    pushRecentTemplateId("a");
    pushRecentTemplateId("b");
    pushRecentTemplateId("a");

    expect(getRecentTemplateIds()).toEqual(["a", "b"]);
  });

  it("toggles template favorites", () => {
    expect(toggleFavoriteTemplateId("tpl-1")).toBe(true);
    expect(isFavoriteTemplateId("tpl-1")).toBe(true);
    expect(getFavoriteTemplateIds()).toEqual(["tpl-1"]);

    expect(toggleFavoriteTemplateId("tpl-1")).toBe(false);
    expect(isFavoriteTemplateId("tpl-1")).toBe(false);
    expect(getFavoriteTemplateIds()).toEqual([]);
  });
});
