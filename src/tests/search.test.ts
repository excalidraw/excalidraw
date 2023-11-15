import { ExcalidrawElement } from "../element/types";
import { textSearch } from "../search";

describe("textSearch", () => {
  it("works with normal/edge cases", () => {
    textSearch.resetSearch();
    let result = textSearch.search("hello");
    expect(result).toEqual([]);

    let elems = [
      {
        id: "1",
        type: "text",
        text: "hello, world",
      },
    ] as ExcalidrawElement[];
    textSearch.replaceAllElements(elems);
    result = textSearch.search("hello");
    expect(result.length).toEqual(1);
    expect(result[0].id).toEqual("1");

    elems = [
      {
        id: "1",
        type: "text",
        text: "world",
      },
    ] as ExcalidrawElement[];
    textSearch.replaceAllElements(elems);
    result = textSearch.search("hello");
    expect(result).toEqual([]);

    elems = [
      {
        id: "1",
        type: "text",
        text: "hello, world",
      },
      {
        id: "2",
        type: "text",
        text: "hello",
      },
    ] as ExcalidrawElement[];
    textSearch.replaceAllElements(elems);
    result = textSearch.search("hello");
    expect(result.length).toEqual(2);

    elems = [
      {
        id: "2",
        type: "text",
        text: "hello",
      },
      {
        id: "3",
        type: "text",
        text: "world hello",
      },
    ] as ExcalidrawElement[];
    textSearch.replaceAllElements(elems);
    result = textSearch.search("hello");
    expect(result.length).toEqual(2);
    expect(new Set(result.map((r) => r.id))).toEqual(new Set(["2", "3"]));

    result = textSearch.search("hello world");
    expect(result.length).toEqual(2);
    expect(new Set(result.map((r) => r.id))).toEqual(new Set(["2", "3"]));
    expect(new Set(Object.keys(result[0].match))).toEqual(
      new Set(["world", "hello"]),
    );

    result = textSearch.search("bazika");
    expect(result).toEqual([]);
  });
});
