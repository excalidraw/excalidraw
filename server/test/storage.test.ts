import http from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertSafeKey } from "../src/storage/keys";
import { LocalStorage } from "../src/storage/local";
import { S3Storage } from "../src/storage/s3";
import { createStorage } from "../src/storage";
import { loadConfig } from "../src/config";

import type { AddressInfo } from "node:net";
import type { StorageProvider } from "../src/storage";

describe("assertSafeKey", () => {
  it("accepts generated ids and refuses traversal and odd characters", () => {
    expect(assertSafeKey("scenes/6abc/file_1-a.png")).toBe(
      "scenes/6abc/file_1-a.png",
    );
    for (const bad of [
      "",
      "../etc/passwd",
      "a/../b",
      "/abs",
      "a//b",
      "a/./b",
      "sp ace",
      "a\\b",
      "a%2e%2e/b",
      "nul\0",
    ]) {
      expect(() => assertSafeKey(bad), JSON.stringify(bad)).toThrow();
    }
  });
});

/** Behaviour every provider must share. */
const contract = (
  name: string,
  make: () => Promise<{
    storage: StorageProvider;
    cleanup: () => Promise<void>;
  }>,
) => {
  describe(`${name} provider contract`, () => {
    let storage: StorageProvider;
    let cleanup: () => Promise<void>;
    beforeAll(async () => {
      ({ storage, cleanup } = await make());
    });
    afterAll(async () => cleanup());

    it("round-trips bytes and content type; missing keys are null", async () => {
      const data = Buffer.from([0, 1, 2, 250, 255]);
      await storage.put("scenes/a1/img1", data, "image/png");
      const got = await storage.get("scenes/a1/img1");
      expect(got!.data.equals(data)).toBe(true);
      expect(got!.contentType).toBe("image/png");
      expect(await storage.get("scenes/a1/missing")).toBeNull();
    });

    it("overwrites, deletes one key, and deletes by prefix without touching neighbours", async () => {
      await storage.put("scenes/b1/x", Buffer.from("1"), "image/png");
      await storage.put("scenes/b1/x", Buffer.from("22"), "image/webp");
      expect((await storage.get("scenes/b1/x"))!.data.toString()).toBe("22");
      await storage.put("scenes/b1/y", Buffer.from("y"), "image/png");
      await storage.put("scenes/b10/z", Buffer.from("z"), "image/png"); // shares the textual prefix "scenes/b1"
      await storage.delete("scenes/b1/x");
      expect(await storage.get("scenes/b1/x")).toBeNull();
      await storage.deletePrefix("scenes/b1");
      expect(await storage.get("scenes/b1/y")).toBeNull();
      expect(await storage.get("scenes/b10/z")).not.toBeNull();
    });

    it("refuses unsafe keys before touching the backend", async () => {
      await expect(
        storage.put("../escape", Buffer.from("x"), "image/png"),
      ).rejects.toThrow();
      await expect(storage.get("a/../../b")).rejects.toThrow();
      await expect(storage.deletePrefix("../")).rejects.toThrow();
    });
  });
};

let localDir = "";
contract("local", async () => {
  localDir = await mkdtemp(path.join(os.tmpdir(), "ew-local-"));
  return {
    storage: new LocalStorage(localDir),
    cleanup: () => rm(localDir, { recursive: true, force: true }),
  };
});

describe("local provider specifics", () => {
  it("never writes outside its root", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ew-local2-"));
    const s = new LocalStorage(dir);
    await expect(
      s.put("../../evil", Buffer.from("x"), "image/png"),
    ).rejects.toThrow();
    await s.put("scenes/ok/file", Buffer.from("x"), "image/png");
    expect(await readdir(dir)).toEqual(["scenes"]);
    await rm(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------- fake S3 (path-style)
const objects = new Map<string, { body: Buffer; type: string }>();
const s3Server = http.createServer((req, res) => {
  const url = new URL(req.url!, "http://x");
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const [, bucket, ...rest] = url.pathname.split("/");
    const key = decodeURIComponent(rest.join("/"));
    if (bucket !== "bkt") {
      res.writeHead(404);
      return res.end();
    }
    if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
      res.writeHead(200, { "content-type": "application/xml" });
      return res.end(
        `<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>${keys
          .map((k) => `<Contents><Key>${k}</Key></Contents>`)
          .join("")}</ListBucketResult>`,
      );
    }
    if (req.method === "PUT") {
      objects.set(key, {
        body: Buffer.concat(chunks),
        type: String(req.headers["content-type"]),
      });
      res.writeHead(200, { etag: '"x"' });
      return res.end();
    }
    if (req.method === "GET") {
      const o = objects.get(key);
      if (!o) {
        res.writeHead(404, { "content-type": "application/xml" });
        return res.end(
          '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>nope</Message></Error>',
        );
      }
      res.writeHead(200, {
        "content-type": o.type,
        "content-length": o.body.length,
      });
      return res.end(o.body);
    }
    if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(405);
    res.end();
  });
});
let s3Port = 0;
beforeAll(async () => {
  await new Promise<void>((r) => s3Server.listen(0, "127.0.0.1", r));
  s3Port = (s3Server.address() as AddressInfo).port;
});
afterAll(async () => {
  s3Server.closeAllConnections();
  await new Promise((r) => s3Server.close(r));
});

contract("s3", async () => {
  // s3Port is assigned in beforeAll above, which runs before this contract's beforeAll
  const storage = new S3Storage({
    endpoint: `http://127.0.0.1:${s3Port}`,
    region: "us-east-1",
    bucket: "bkt",
    accessKey: "AK",
    secretKey: "SK",
    forcePathStyle: true,
  });
  return { storage, cleanup: async () => storage.destroy() };
});

describe("s3 provider specifics", () => {
  it("applies the configured key prefix", async () => {
    objects.clear();
    const s = new S3Storage({
      endpoint: `http://127.0.0.1:${s3Port}`,
      region: "us-east-1",
      bucket: "bkt",
      accessKey: "AK",
      secretKey: "SK",
      forcePathStyle: true,
      prefix: "/tenant-a/",
    });
    await s.put("scenes/p/f", Buffer.from("x"), "image/png");
    expect([...objects.keys()]).toEqual(["tenant-a/scenes/p/f"]);
    expect((await s.get("scenes/p/f"))!.data.toString()).toBe("x");
    await s.deletePrefix("scenes/p");
    expect(objects.size).toBe(0);
    s.destroy();
  });
});

describe("createStorage", () => {
  const env = { NODE_ENV: "test", SESSION_SECRET: "x".repeat(40) };
  it("builds the configured provider and validates S3 settings", () => {
    expect(createStorage(loadConfig({ ...env }))).toBeInstanceOf(LocalStorage);
    expect(() =>
      createStorage(loadConfig({ ...env, STORAGE_PROVIDER: "s3" })),
    ).toThrow(/S3_BUCKET/);
    const s3 = createStorage(
      loadConfig({
        ...env,
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "b",
        S3_ENDPOINT: "http://minio:9000",
        S3_ACCESS_KEY: "a",
        S3_SECRET_KEY: "s",
      }),
    );
    expect(s3).toBeInstanceOf(S3Storage);
    (s3 as S3Storage).destroy();
  });
});
