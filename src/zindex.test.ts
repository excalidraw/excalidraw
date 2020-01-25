import { moveOneLeft, moveOneRight, moveAllLeft, moveAllRight } from "./zindex";

function expectMove<T>(
  fn: (elements: T[], indicesToMove: number[]) => void,
  elems: T[],
  indices: number[],
  equal: T[],
) {
  fn(elems, indices);
  expect(elems).toEqual(equal);
}

it("should moveOneLeft", () => {
  expectMove(moveOneLeft, ["a", "b", "c", "d"], [1, 2], ["b", "c", "a", "d"]);
  expectMove(moveOneLeft, ["a", "b", "c", "d"], [0], ["a", "b", "c", "d"]);
  expectMove(
    moveOneLeft,
    ["a", "b", "c", "d"],
    [0, 1, 2, 3],
    ["a", "b", "c", "d"],
  );
  expectMove(moveOneLeft, ["a", "b", "c", "d"], [1, 3], ["b", "a", "d", "c"]);
});

it("should moveOneRight", () => {
  expectMove(moveOneRight, ["a", "b", "c", "d"], [1, 2], ["a", "d", "b", "c"]);
  expectMove(moveOneRight, ["a", "b", "c", "d"], [3], ["a", "b", "c", "d"]);
  expectMove(
    moveOneRight,
    ["a", "b", "c", "d"],
    [0, 1, 2, 3],
    ["a", "b", "c", "d"],
  );
  expectMove(moveOneRight, ["a", "b", "c", "d"], [0, 2], ["b", "a", "d", "c"]);
});

it("should moveAllLeft", () => {
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [2, 5],
    ["c", "f", "a", "b", "d", "e", "g"],
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [5],
    ["f", "a", "b", "c", "d", "e", "g"],
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2, 3, 4, 5, 6],
    ["a", "b", "c", "d", "e", "f", "g"],
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2],
    ["a", "b", "c", "d", "e", "f", "g"],
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [4, 5, 6],
    ["e", "f", "g", "a", "b", "c", "d"],
  );
});

it("should moveAllRight", () => {
  expectMove(
    moveAllRight,
    ["a", "b", "c", "d", "e", "f", "g"],
    [2, 5],
    ["a", "b", "d", "e", "g", "c", "f"],
  );
  expectMove(
    moveAllRight,
    ["a", "b", "c", "d", "e", "f", "g"],
    [5],
    ["a", "b", "c", "d", "e", "g", "f"],
  );
  expectMove(
    moveAllRight,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2, 3, 4, 5, 6],
    ["a", "b", "c", "d", "e", "f", "g"],
  );
  expectMove(
    moveAllRight,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2],
    ["d", "e", "f", "g", "a", "b", "c"],
  );
  expectMove(
    moveAllRight,
    ["a", "b", "c", "d", "e", "f", "g"],
    [4, 5, 6],
    ["a", "b", "c", "d", "e", "f", "g"],
  );
});
