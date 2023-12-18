import { Random } from "roughjs/bin/math";
import { nanoid, customAlphabet } from "nanoid"; //zsviczian
import { isTestEnv } from "./utils";

let random = new Random(Date.now());
let testIdBase = 0;

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = (seed: number) => {
  random = new Random(seed);
  testIdBase = 0;
};

export const randomId = () => (isTestEnv() ? `id${testIdBase++}` : nanoid());
export const obsidianId = customAlphabet(
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  8,
); //zsviczian: added size
