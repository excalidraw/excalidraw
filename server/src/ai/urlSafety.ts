import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {}

const ipv4ToInt = (ip: string) =>
  ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
const inCidr = (ip: number, base: string, bits: number) => {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
};

/** Cloud metadata / link-local: never reachable, whatever the settings. */
const isAlwaysBlocked = (ip: string) => {
  if (isIP(ip) === 4) {
    return (
      inCidr(ipv4ToInt(ip), "169.254.0.0", 16) ||
      inCidr(ipv4ToInt(ip), "0.0.0.0", 8)
    );
  }
  const l = ip.toLowerCase();
  return (
    l.startsWith("fe80:") ||
    l === "::" ||
    l.startsWith("::ffff:169.254.") ||
    l.startsWith("fd00:ec2")
  );
};

const isPrivate = (ip: string) => {
  if (isIP(ip) === 4) {
    const n = ipv4ToInt(ip);
    return (
      inCidr(n, "10.0.0.0", 8) ||
      inCidr(n, "172.16.0.0", 12) ||
      inCidr(n, "192.168.0.0", 16) ||
      inCidr(n, "127.0.0.0", 8) ||
      inCidr(n, "100.64.0.0", 10)
    );
  }
  const l = ip.toLowerCase();
  return (
    l === "::1" ||
    l.startsWith("fc") ||
    l.startsWith("fd") ||
    l.startsWith("::ffff:127.") ||
    l.startsWith("::ffff:10.") ||
    l.startsWith("::ffff:192.168.")
  );
};

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

/**
 * SSRF guard for admin-configured provider endpoints. Checks syntax and (unless the
 * instance allows private targets, e.g. a local Ollama) what the host resolves to.
 */
export const assertSafeBaseUrl = async (raw: string, allowPrivate: boolean) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("not a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("only http(s) URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("credentials in URLs are not allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new UnsafeUrlError("this host is not allowed");
  }
  const addrs: string[] = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) {
    throw new UnsafeUrlError("host does not resolve");
  }
  for (const ip of addrs) {
    if (isAlwaysBlocked(ip)) {
      throw new UnsafeUrlError(
        "link-local and metadata addresses are not allowed",
      );
    }
    if (!allowPrivate && isPrivate(ip)) {
      throw new UnsafeUrlError(
        "private network addresses are not allowed on this instance",
      );
    }
  }
  return url;
};
