import { Random } from "roughjs/bin/math";
import nanoid from "nanoid";

let random = new Random(Date.now());
let testIdBase = 0;

export function randomInteger() {
  return Math.floor(random.next() * 2 ** 31);
}

export function reseed(seed: number) {
  random = new Random(seed);
  testIdBase = 0;
}

export function randomId() {
  return process.env.NODE_ENV === "test" ? `id${testIdBase++}` : nanoid();
}
