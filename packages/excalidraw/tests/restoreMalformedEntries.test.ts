import { restoreElements } from "../data/restore";

import { API } from "./helpers/api";

const rect = (id: string) => API.createElement({ type: "rectangle", id });

const idsOf = (elements: unknown[]) =>
  (restoreElements(elements as any, null) as any[]).map(
    (element) => element.id,
  );

describe("restoreElements with malformed entries", () => {
  it("restores a well formed scene unchanged", () => {
    expect(idsOf([rect("a"), rect("b")])).toEqual(["a", "b"]);
  });

  it("skips a null entry and keeps the rest of the scene", () => {
    expect(idsOf([null, rect("a"), rect("b")])).toEqual(["a", "b"]);
  });

  it("skips undefined entries", () => {
    expect(idsOf([undefined, rect("a"), undefined])).toEqual(["a"]);
  });

  it("skips primitives", () => {
    expect(idsOf([0, "", "nope", true, rect("a")])).toEqual(["a"]);
  });

  it("survives a scene made entirely of malformed entries", () => {
    expect(idsOf([null, undefined, 1])).toEqual([]);
  });

  it("still drops legacy selection elements", () => {
    expect(idsOf([{ type: "selection", id: "sel" }, rect("a")])).toEqual(["a"]);
  });
});
