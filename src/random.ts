// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
export const LCG = (seed: number) => () =>
  ((2 ** 31 - 1) & (seed = Math.imul(48271, seed))) / 2 ** 31;

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

// Unfortunately, roughjs doesn't support a seed attribute (https://github.com/pshihn/rough/issues/27).
// We can achieve the same result by overriding the Math.random function with a
// pseudo random generator that supports a random seed and swapping it back after.
export function withCustomMathRandom<T>(seed: number, cb: () => T): T {
  const random = Math.random;
  Math.random = LCG(seed);
  const result = cb();
  Math.random = random;
  return result;
}
