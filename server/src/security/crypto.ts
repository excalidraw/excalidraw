import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/** Derives a domain-separated 256-bit key from the server secret. */
const keyFor = (secret: string, purpose: string) =>
  createHash("sha256").update(`${purpose}:${secret}`).digest();

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export const encryptSecret = (
  plain: string,
  secret: string,
  purpose: string,
) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret, purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
};

export const decryptSecret = (
  payload: string,
  secret: string,
  purpose: string,
) => {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFor(secret, purpose),
    buf.subarray(0, 12),
  );
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
};
