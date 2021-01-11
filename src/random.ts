import { Random } from "roughjs/bin/math";
import { nanoid } from "nanoid";

let random = new Random(Date.now());
let testIdBase = 0;

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = (seed: number) => {
  random = new Random(seed);
  testIdBase = 0;
};

export const randomId = () =>
  process.env.NODE_ENV === "test" ? `id${testIdBase++}` : nanoid();
