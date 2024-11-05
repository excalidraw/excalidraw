import { memo } from "./utils";

describe("utils", () => {
  it("memo should memoize if the arguments are the same", () => {
    const mock = jest.fn();
    const memoized = memo(mock);
    memoized(1, 2, 3);
    memoized(1, 2, 3);
    expect(mock).toHaveBeenCalledTimes(1);
    memoized(1, 2);
    expect(mock).toHaveBeenCalledTimes(2);
    memoized(1, 2, 3);
    expect(mock).toHaveBeenCalledTimes(3);
    memoized({ a: [1, 2, 3] });
    memoized({ a: [1, 2, 3] });
    memoized({ a: [1, 4, 3] });
    expect(mock).toHaveBeenCalledTimes(5);
  });
});
