import { moveOneLeft, moveAllLeft } from "./zindex";

function expectMove(fn, elems, indices, equal) {
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
    ["a", "b", "c", "d"]
  );
  expectMove(moveOneLeft, ["a", "b", "c", "d"], [1, 3], ["b", "a", "d", "c"]);
});

it("should moveAllLeft", () => {
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [2, 5],
    ["c", "f", "a", "b", "d", "e", "g"]
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [5],
    ["f", "a", "b", "c", "d", "e", "g"]
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2, 3, 4, 5, 6],
    ["a", "b", "c", "d", "e", "f", "g"]
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [0, 1, 2],
    ["a", "b", "c", "d", "e", "f", "g"]
  );
  expectMove(
    moveAllLeft,
    ["a", "b", "c", "d", "e", "f", "g"],
    [4, 5, 6],
    ["e", "f", "g", "a", "b", "c", "d"]
  );
});
