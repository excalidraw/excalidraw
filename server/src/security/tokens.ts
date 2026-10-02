import { createHmac, randomBytes } from "node:crypto";

/** 256-bit unguessable token, URL/cookie safe. */
export const generateToken = (bytes = 32) =>
  randomBytes(bytes).toString("base64url");

/** Keyed hash so a DB leak alone can't be used to forge/verify tokens. */
export const hashToken = (token: string, secret: string) =>
  createHmac("sha256", secret).update(token).digest("hex");
