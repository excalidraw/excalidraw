import { newElement, newTextElement, duplicateElement } from "./newElement";

function isPrimitive(val: any) {
  const type = typeof val;
  return val == null || (type !== "object" && type !== "function");
}

function assertCloneObjects(source: any, clone: any) {
  for (const key in clone) {
    if (clone.hasOwnProperty(key) && !isPrimitive(clone[key])) {
      expect(clone[key]).not.toBe(source[key]);
      if (source[key]) {
        assertCloneObjects(source[key], clone[key]);
      }
    }
  }
}

it("clones arrow element", () => {
  const element = newElement(
    "arrow",
    0,
    0,
    "#000000",
    "transparent",
    "hachure",
    1,
    1,
    100,
  );

  // @ts-ignore
  element.__proto__ = { hello: "world" };

  element.points = [
    [1, 2],
    [3, 4],
  ];

  const copy = duplicateElement(element);

  assertCloneObjects(element, copy);

  expect(copy.__proto__).toEqual({ hello: "world" });
  expect(copy.hasOwnProperty("hello")).toBe(false);

  expect(copy.points).not.toBe(element.points);
  expect(copy).not.toHaveProperty("shape");
  expect(copy.id).not.toBe(element.id);
  expect(typeof copy.id).toBe("string");
  expect(copy.seed).not.toBe(element.seed);
  expect(typeof copy.seed).toBe("number");
  expect(copy).toEqual({
    ...element,
    id: copy.id,
    seed: copy.seed,
  });
});

it("clones text element", () => {
  const element = newTextElement(
    newElement("text", 0, 0, "#000000", "transparent", "hachure", 1, 1, 100),
    "hello",
    "Arial 20px",
  );

  const copy = duplicateElement(element);

  assertCloneObjects(element, copy);

  expect(copy.points).not.toBe(element.points);
  expect(copy).not.toHaveProperty("shape");
  expect(copy.id).not.toBe(element.id);
  expect(typeof copy.id).toBe("string");
  expect(typeof copy.seed).toBe("number");
});
