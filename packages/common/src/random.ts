import { nanoid } from "nanoid";
import { Random } from "roughjs/bin/math";

import { isTestEnv } from "./utils";

let random = new Random(Date.now());
let testIdBase = 0;

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = (seed: number) => {
  random = new Random(seed);
  testIdBase = 0;
};

export const randomId = () => (isTestEnv() ? `id${testIdBase++}` : nanoid());

/**
 * Deterministic PRNG (mulberry32) for a given seed: same seed, same
 * sequence — used where a render must be stable across frames and clients
 * (e.g. the sticky note's corner jitter) and roughjs's `Random` is
 * unsuitable (it degenerates for seed 0). Returns numbers in [0, 1).
 */
export const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};
