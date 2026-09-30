import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt (RFC 7914) from node:crypto: no native addon needed.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

const derive = (password: string, salt: Buffer, n: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEYLEN,
      { N: n, r: R, p: P, maxmem: 128 * n * R * 2 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );

/** Format: scrypt$N$salt(b64)$hash(b64) so parameters can be upgraded later. */
export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  const [alg, nStr, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !nStr || !saltB64 || !hashB64) {
    return false;
  }
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(
    password,
    Buffer.from(saltB64, "base64"),
    Number(nStr),
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

/** Constant-ish work for unknown emails so timing doesn't reveal existence. */
let dummy: Promise<string> | null = null;
export const burnPasswordCheck = async (password: string) => {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password, await dummy);
};
