# Custom Collab Backend (replacing Firebase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase (Firestore + Storage) with a self-hosted Express + Prisma + PostgreSQL + GCS backend for Excalidraw's live-collaboration feature, and remove the two unrelated Firebase-dependent features (Export to Excalidraw+, Export to a link) so `firebase.ts` can be deleted cleanly.

**Architecture:** A new `backend/` workspace package runs a single Node process combining an Express REST API (scene + file persistence) and a `socket.io` server (real-time relay, ported verbatim from `excalidraw/excalidraw-room`) on one HTTP server. The frontend's `excalidraw-app/data/firebase.ts` is replaced by `excalidraw-app/data/backend.ts`, calling the new REST API instead of the Firebase SDK, with identical external behavior for `Collab.tsx`. Deployment adds a `postgres` + `backend` container behind the existing frontend's nginx, which reverse-proxies `/api/*` and `/socket.io/*`.

**Tech Stack:** Express 4, Prisma 5 + PostgreSQL, `socket.io` 4 (server), `@google-cloud/storage`, TypeScript (ESM), Vitest, Supertest, Docker + nginx.

## Global Constraints

- No authentication — access control is the existing `roomId`/`roomKey`-in-URL-hash model. `roomKey` must never be sent to the backend.
- Scene/file data is retained forever — no TTL/auto-delete logic.
- Files are proxied through Express to GCS (client → Express → GCS), not signed URLs.
- `socket.io` and the REST API run in the same Node process/container.
- Spec: `docs/superpowers/specs/2026-08-12-custom-collab-backend-design.md`.

---

## Task 1: Scaffold the `backend/` package

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/.gitignore`
- Modify: `package.json:5-9` (root workspaces array)

**Interfaces:**
- Produces: a `backend` yarn workspace with `yarn workspace backend <script>` runnable from repo root; a Prisma schema with `Scene` and `SceneFile` models migrated into a local Postgres.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@google-cloud/storage": "^7.14.0",
    "@prisma/client": "^5.22.0",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.16.5",
    "prisma": "^5.22.0",
    "socket.io-client": "^4.8.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.1",
    "typescript": "5.9.3",
    "vitest": "3.0.6"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 4: Create `backend/.env.example`**

```
PORT=3010
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/excalidraw_backend
GCS_BUCKET=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=../gcs-key.json
```

- [ ] **Step 5: Create `backend/.gitignore`**

```
dist
node_modules
.env
```

- [ ] **Step 6: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Scene {
  roomId     String   @id
  ciphertext Bytes
  iv         Bytes
  revision   Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model SceneFile {
  id        String   @id
  roomId    String
  gcsPath   String
  createdAt DateTime @default(now())

  @@index([roomId])
}
```

Note: no foreign key between `SceneFile.roomId` and `Scene.roomId` — files can legitimately be uploaded before the first scene save completes, and Firestore/Storage had no such constraint either.

- [ ] **Step 7: Register the workspace**

Modify `package.json:5-9`:

```json
  "workspaces": [
    "backend",
    "excalidraw-app",
    "packages/*",
    "examples/*"
  ],
```

- [ ] **Step 8: Install dependencies**

Run: `yarn install` (from repo root)
Expected: completes without errors; `backend/node_modules` and root `node_modules` updated.

- [ ] **Step 9: Start a local Postgres for development/testing**

Run: `docker run -d --name excalidraw-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=excalidraw_backend -p 5432:5432 postgres:16-alpine`
Expected: container starts and stays running (`docker ps` shows it).

- [ ] **Step 10: Create `backend/.env` and run the first migration**

Run: `cp backend/.env.example backend/.env` then `yarn workspace backend prisma:migrate -- --name init`
Expected: prompts complete, `backend/prisma/migrations/<timestamp>_init/` is created, command exits 0.

- [ ] **Step 11: Commit**

```bash
git add package.json backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/.env.example backend/.gitignore backend/prisma
git commit -m "chore(backend): scaffold Express+Prisma backend package"
```

---

## Task 2: Scenes repository (optimistic-concurrency save)

Firestore's `saveToFirebase` used a `runTransaction` to atomically read-decrypt-reconcile-write. The browser holds the decryption key, so reconciliation must stay client-side; the backend replicates the safety property with **compare-and-swap**: `PUT` includes the revision the client last read, and the write only lands if the stored revision still matches. On mismatch, the caller gets the current data back and is expected to retry (see Task 9).

**Files:**
- Create: `backend/src/db.ts`
- Create: `backend/src/env.ts`
- Create: `backend/src/scenes/scenesRepository.ts`
- Test: `backend/src/scenes/scenesRepository.test.ts`

**Interfaces:**
- Produces: `getScene(roomId: string): Promise<StoredScene | null>`, `saveScene(roomId: string, ciphertext: Buffer, iv: Buffer, expectedRevision: number): Promise<SaveResult>` where `StoredScene = {ciphertext: Buffer, iv: Buffer, revision: number}` and `SaveResult = {accepted: true, revision: number} | {accepted: false, current: StoredScene}`.
- Consumes: `prisma` client from `./db`.

- [ ] **Step 1: Create `backend/src/env.ts`**

```ts
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3010),
  databaseUrl: required("DATABASE_URL"),
  gcsBucket: required("GCS_BUCKET"),
};
```

- [ ] **Step 2: Create `backend/src/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/scenes/scenesRepository.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db";
import { getScene, saveScene } from "./scenesRepository";

beforeEach(async () => {
  await prisma.scene.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getScene", () => {
  it("returns null for an unknown room", async () => {
    expect(await getScene("missing-room")).toBeNull();
  });
});

describe("saveScene", () => {
  it("creates a new room when expectedRevision is 0", async () => {
    const result = await saveScene(
      "room-1",
      Buffer.from("cipher"),
      Buffer.from("iv"),
      0,
    );

    expect(result).toEqual({ accepted: true, revision: 1 });
    expect((await getScene("room-1"))?.revision).toBe(1);
  });

  it("rejects a stale expectedRevision and returns the current scene", async () => {
    await saveScene("room-1", Buffer.from("v1"), Buffer.from("iv1"), 0);

    const result = await saveScene(
      "room-1",
      Buffer.from("v2-stale"),
      Buffer.from("iv2"),
      0, // stale: room already exists at revision 1
    );

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.current.revision).toBe(1);
      expect(result.current.ciphertext.toString()).toBe("v1");
    }
  });

  it("accepts a save when expectedRevision matches the current revision", async () => {
    await saveScene("room-1", Buffer.from("v1"), Buffer.from("iv1"), 0);

    const result = await saveScene(
      "room-1",
      Buffer.from("v2"),
      Buffer.from("iv2"),
      1,
    );

    expect(result).toEqual({ accepted: true, revision: 2 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/scenes/scenesRepository.test.ts`
Expected: FAIL — `Cannot find module './scenesRepository'`.

- [ ] **Step 3: Implement `backend/src/scenes/scenesRepository.ts`**

```ts
import { prisma } from "../db";

export type StoredScene = {
  ciphertext: Buffer;
  iv: Buffer;
  revision: number;
};

export type SaveResult =
  | { accepted: true; revision: number }
  | { accepted: false; current: StoredScene };

export async function getScene(roomId: string): Promise<StoredScene | null> {
  const scene = await prisma.scene.findUnique({ where: { roomId } });
  if (!scene) {
    return null;
  }
  return { ciphertext: scene.ciphertext, iv: scene.iv, revision: scene.revision };
}

export async function saveScene(
  roomId: string,
  ciphertext: Buffer,
  iv: Buffer,
  expectedRevision: number,
): Promise<SaveResult> {
  if (expectedRevision === 0) {
    try {
      const created = await prisma.scene.create({
        data: { roomId, ciphertext, iv, revision: 1 },
      });
      return { accepted: true, revision: created.revision };
    } catch {
      // unique constraint violation: the room was created concurrently
      const current = await getScene(roomId);
      if (!current) {
        throw new Error(`Room ${roomId} failed to create and does not exist`);
      }
      return { accepted: false, current };
    }
  }

  const result = await prisma.scene.updateMany({
    where: { roomId, revision: expectedRevision },
    data: { ciphertext, iv, revision: expectedRevision + 1 },
  });

  if (result.count === 0) {
    const current = await getScene(roomId);
    if (!current) {
      throw new Error(`Room ${roomId} disappeared during save`);
    }
    return { accepted: false, current };
  }

  return { accepted: true, revision: expectedRevision + 1 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/scenes/scenesRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/db.ts backend/src/env.ts backend/src/scenes/scenesRepository.ts backend/src/scenes/scenesRepository.test.ts
git commit -m "feat(backend): scenes repository with optimistic-concurrency save"
```

---

## Task 3: Scenes REST router

**Files:**
- Create: `backend/src/scenes/scenesRouter.ts`
- Test: `backend/src/scenes/scenesRouter.test.ts`

**Interfaces:**
- Consumes: `getScene`, `saveScene` from `./scenesRepository` (Task 2).
- Produces: an Express `Router` exporting `GET /:roomId` and `PUT /:roomId`, mounted at `/api/scenes` in Task 8. Response bodies use base64 strings for `ciphertext`/`iv`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/scenes/scenesRouter.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./scenesRepository", () => ({
  getScene: vi.fn(),
  saveScene: vi.fn(),
}));

import { getScene, saveScene } from "./scenesRepository";
import { scenesRouter } from "./scenesRouter";

const app = express();
app.use(express.json());
app.use("/api/scenes", scenesRouter);

beforeEach(() => {
  vi.mocked(getScene).mockReset();
  vi.mocked(saveScene).mockReset();
});

describe("GET /api/scenes/:roomId", () => {
  it("returns 404 for an unknown room", async () => {
    vi.mocked(getScene).mockResolvedValue(null);

    const response = await request(app).get("/api/scenes/room-1");

    expect(response.status).toBe(404);
  });

  it("returns base64-encoded scene data", async () => {
    vi.mocked(getScene).mockResolvedValue({
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.from("iv"),
      revision: 3,
    });

    const response = await request(app).get("/api/scenes/room-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ciphertext: Buffer.from("cipher").toString("base64"),
      iv: Buffer.from("iv").toString("base64"),
      revision: 3,
    });
  });
});

describe("PUT /api/scenes/:roomId", () => {
  it("rejects a malformed body", async () => {
    const response = await request(app).put("/api/scenes/room-1").send({});

    expect(response.status).toBe(400);
  });

  it("returns 409 with the current scene on a revision conflict", async () => {
    vi.mocked(saveScene).mockResolvedValue({
      accepted: false,
      current: { ciphertext: Buffer.from("v1"), iv: Buffer.from("iv1"), revision: 1 },
    });

    const response = await request(app)
      .put("/api/scenes/room-1")
      .send({ ciphertext: "Yw==", iv: "aXY=", expectedRevision: 0 });

    expect(response.status).toBe(409);
    expect(response.body.current.revision).toBe(1);
  });

  it("returns the new revision on success", async () => {
    vi.mocked(saveScene).mockResolvedValue({ accepted: true, revision: 1 });

    const response = await request(app)
      .put("/api/scenes/room-1")
      .send({ ciphertext: "Yw==", iv: "aXY=", expectedRevision: 0 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revision: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/scenes/scenesRouter.test.ts`
Expected: FAIL — `Cannot find module './scenesRouter'`.

- [ ] **Step 3: Implement `backend/src/scenes/scenesRouter.ts`**

```ts
import { Router } from "express";

import { getScene, saveScene } from "./scenesRepository";

export const scenesRouter = Router();

scenesRouter.get("/:roomId", async (req, res) => {
  const scene = await getScene(req.params.roomId);
  if (!scene) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  res.json({
    ciphertext: scene.ciphertext.toString("base64"),
    iv: scene.iv.toString("base64"),
    revision: scene.revision,
  });
});

scenesRouter.put("/:roomId", async (req, res) => {
  const { ciphertext, iv, expectedRevision } = req.body as {
    ciphertext?: string;
    iv?: string;
    expectedRevision?: number;
  };

  if (
    typeof ciphertext !== "string" ||
    typeof iv !== "string" ||
    typeof expectedRevision !== "number"
  ) {
    res
      .status(400)
      .json({ error: "ciphertext, iv and expectedRevision are required" });
    return;
  }

  const result = await saveScene(
    req.params.roomId,
    Buffer.from(ciphertext, "base64"),
    Buffer.from(iv, "base64"),
    expectedRevision,
  );

  if (!result.accepted) {
    res.status(409).json({
      error: "revision conflict",
      current: {
        ciphertext: result.current.ciphertext.toString("base64"),
        iv: result.current.iv.toString("base64"),
        revision: result.current.revision,
      },
    });
    return;
  }

  res.json({ revision: result.revision });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/scenes/scenesRouter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scenes/scenesRouter.ts backend/src/scenes/scenesRouter.test.ts
git commit -m "feat(backend): scenes REST router"
```

---

## Task 4: GCS client wrapper

**Files:**
- Create: `backend/src/gcs.ts`
- Test: `backend/src/gcs.test.ts`

**Interfaces:**
- Produces: `uploadObject(path: string, data: Buffer): Promise<void>`, `downloadObject(path: string): Promise<Buffer>`.
- Consumes: `env.gcsBucket` from `./env` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `backend/src/gcs.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const downloadMock = vi.fn();
const fileMock = vi.fn(() => ({ save: saveMock, download: downloadMock }));
const bucketMock = vi.fn(() => ({ file: fileMock }));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn(() => ({ bucket: bucketMock })),
}));

vi.mock("./env", () => ({ env: { gcsBucket: "test-bucket" } }));

import { downloadObject, uploadObject } from "./gcs";

describe("uploadObject", () => {
  it("saves the buffer to the given path in the bucket", async () => {
    saveMock.mockResolvedValue(undefined);

    await uploadObject("rooms/room-1/file-1", Buffer.from("data"));

    expect(bucketMock).toHaveBeenCalledWith("test-bucket");
    expect(fileMock).toHaveBeenCalledWith("rooms/room-1/file-1");
    expect(saveMock).toHaveBeenCalledWith(Buffer.from("data"), {
      resumable: false,
    });
  });
});

describe("downloadObject", () => {
  it("returns the downloaded buffer", async () => {
    downloadMock.mockResolvedValue([Buffer.from("data")]);

    const result = await downloadObject("rooms/room-1/file-1");

    expect(result.toString()).toBe("data");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/gcs.test.ts`
Expected: FAIL — `Cannot find module './gcs'`.

- [ ] **Step 3: Implement `backend/src/gcs.ts`**

```ts
import { Storage } from "@google-cloud/storage";

import { env } from "./env";

const storage = new Storage();
const bucket = storage.bucket(env.gcsBucket);

export async function uploadObject(path: string, data: Buffer): Promise<void> {
  await bucket.file(path).save(data, { resumable: false });
}

export async function downloadObject(path: string): Promise<Buffer> {
  const [data] = await bucket.file(path).download();
  return data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/gcs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/gcs.ts backend/src/gcs.test.ts
git commit -m "feat(backend): GCS client wrapper"
```

---

## Task 5: Files repository

**Files:**
- Create: `backend/src/files/filesRepository.ts`
- Test: `backend/src/files/filesRepository.test.ts`

**Interfaces:**
- Consumes: `uploadObject`, `downloadObject` from `../gcs` (Task 4); `prisma` from `../db` (Task 2).
- Produces: `saveFile(roomId: string, fileId: string, data: Buffer): Promise<void>`, `loadFile(roomId: string, fileId: string): Promise<Buffer | null>`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/files/filesRepository.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../gcs", () => ({
  uploadObject: vi.fn(),
  downloadObject: vi.fn(),
}));

import { downloadObject, uploadObject } from "../gcs";
import { prisma } from "../db";
import { loadFile, saveFile } from "./filesRepository";

beforeEach(async () => {
  await prisma.sceneFile.deleteMany();
  vi.mocked(uploadObject).mockReset();
  vi.mocked(downloadObject).mockReset();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("saveFile", () => {
  it("uploads to GCS and records the file under the room", async () => {
    vi.mocked(uploadObject).mockResolvedValue(undefined);

    await saveFile("room-1", "file-1", Buffer.from("data"));

    expect(uploadObject).toHaveBeenCalledWith(
      "rooms/room-1/file-1",
      Buffer.from("data"),
    );
    const record = await prisma.sceneFile.findUnique({ where: { id: "file-1" } });
    expect(record?.roomId).toBe("room-1");
  });
});

describe("loadFile", () => {
  it("returns null when the file isn't recorded", async () => {
    expect(await loadFile("room-1", "missing")).toBeNull();
  });

  it("returns null when the file belongs to a different room", async () => {
    await prisma.sceneFile.create({
      data: { id: "file-1", roomId: "room-2", gcsPath: "rooms/room-2/file-1" },
    });

    expect(await loadFile("room-1", "file-1")).toBeNull();
  });

  it("downloads from GCS when the file belongs to the room", async () => {
    await prisma.sceneFile.create({
      data: { id: "file-1", roomId: "room-1", gcsPath: "rooms/room-1/file-1" },
    });
    vi.mocked(downloadObject).mockResolvedValue(Buffer.from("data"));

    const result = await loadFile("room-1", "file-1");

    expect(downloadObject).toHaveBeenCalledWith("rooms/room-1/file-1");
    expect(result?.toString()).toBe("data");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/files/filesRepository.test.ts`
Expected: FAIL — `Cannot find module './filesRepository'`.

- [ ] **Step 3: Implement `backend/src/files/filesRepository.ts`**

```ts
import { prisma } from "../db";
import { downloadObject, uploadObject } from "../gcs";

function gcsPathFor(roomId: string, fileId: string): string {
  return `rooms/${roomId}/${fileId}`;
}

export async function saveFile(
  roomId: string,
  fileId: string,
  data: Buffer,
): Promise<void> {
  const gcsPath = gcsPathFor(roomId, fileId);
  await uploadObject(gcsPath, data);
  await prisma.sceneFile.upsert({
    where: { id: fileId },
    create: { id: fileId, roomId, gcsPath },
    update: { gcsPath },
  });
}

export async function loadFile(
  roomId: string,
  fileId: string,
): Promise<Buffer | null> {
  const record = await prisma.sceneFile.findUnique({ where: { id: fileId } });
  if (!record || record.roomId !== roomId) {
    return null;
  }
  return downloadObject(record.gcsPath);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/files/filesRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/files/filesRepository.ts backend/src/files/filesRepository.test.ts
git commit -m "feat(backend): files repository backed by GCS + Postgres metadata"
```

---

## Task 6: Files REST router

Firebase's `loadFilesFromFirebase`/`saveFilesToFirebase` transfer one self-contained encrypted+compressed blob per file (no separate `iv` field at this layer — the client's `compressData` already embeds it). The REST contract mirrors that: one base64 blob per file.

**Files:**
- Create: `backend/src/files/filesRouter.ts`
- Test: `backend/src/files/filesRouter.test.ts`

**Interfaces:**
- Consumes: `saveFile`, `loadFile` from `./filesRepository` (Task 5).
- Produces: an Express `Router` exporting `POST /:roomId` (body `{files: {fileId: string, data: string}[]}` → `{savedFiles: string[], erroredFiles: string[]}`) and `GET /:roomId?ids=a,b,c` (→ `{loadedFiles: {fileId: string, data: string}[], erroredFiles: string[]}`), mounted at `/api/files` in Task 8.

- [ ] **Step 1: Write the failing test**

Create `backend/src/files/filesRouter.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./filesRepository", () => ({
  saveFile: vi.fn(),
  loadFile: vi.fn(),
}));

import { loadFile, saveFile } from "./filesRepository";
import { filesRouter } from "./filesRouter";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/api/files", filesRouter);

beforeEach(() => {
  vi.mocked(saveFile).mockReset();
  vi.mocked(loadFile).mockReset();
});

describe("POST /api/files/:roomId", () => {
  it("reports per-file success and failure", async () => {
    vi.mocked(saveFile).mockImplementation(async (_room, fileId) => {
      if (fileId === "bad") {
        throw new Error("boom");
      }
    });

    const response = await request(app)
      .post("/api/files/room-1")
      .send({
        files: [
          { fileId: "good", data: "ZGF0YQ==" },
          { fileId: "bad", data: "ZGF0YQ==" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ savedFiles: ["good"], erroredFiles: ["bad"] });
  });
});

describe("GET /api/files/:roomId", () => {
  it("returns loaded and errored files by id", async () => {
    vi.mocked(loadFile).mockImplementation(async (_room, fileId) =>
      fileId === "missing" ? null : Buffer.from("data"),
    );

    const response = await request(app).get("/api/files/room-1?ids=present,missing");

    expect(response.status).toBe(200);
    expect(response.body.erroredFiles).toEqual(["missing"]);
    expect(response.body.loadedFiles).toEqual([
      { fileId: "present", data: Buffer.from("data").toString("base64") },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/files/filesRouter.test.ts`
Expected: FAIL — `Cannot find module './filesRouter'`.

- [ ] **Step 3: Implement `backend/src/files/filesRouter.ts`**

```ts
import { Router } from "express";

import { loadFile, saveFile } from "./filesRepository";

export const filesRouter = Router();

filesRouter.post("/:roomId", async (req, res) => {
  const { files } = req.body as {
    files?: { fileId: string; data: string }[];
  };

  if (!Array.isArray(files)) {
    res.status(400).json({ error: "files array is required" });
    return;
  }

  const savedFiles: string[] = [];
  const erroredFiles: string[] = [];

  await Promise.all(
    files.map(async ({ fileId, data }) => {
      try {
        await saveFile(req.params.roomId, fileId, Buffer.from(data, "base64"));
        savedFiles.push(fileId);
      } catch {
        erroredFiles.push(fileId);
      }
    }),
  );

  res.json({ savedFiles, erroredFiles });
});

filesRouter.get("/:roomId", async (req, res) => {
  const ids = String(req.query.ids ?? "")
    .split(",")
    .filter(Boolean);

  const loadedFiles: { fileId: string; data: string }[] = [];
  const erroredFiles: string[] = [];

  await Promise.all(
    ids.map(async (fileId) => {
      const buffer = await loadFile(req.params.roomId, fileId);
      if (!buffer) {
        erroredFiles.push(fileId);
        return;
      }
      loadedFiles.push({ fileId, data: buffer.toString("base64") });
    }),
  );

  res.json({ loadedFiles, erroredFiles });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/files/filesRouter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/files/filesRouter.ts backend/src/files/filesRouter.test.ts
git commit -m "feat(backend): files REST router"
```

---

## Task 7: Real-time signaling relay

Ported verbatim (protocol-wise) from `excalidraw/excalidraw-room`, dropping the `user-follow` feature since this fork's `Portal.tsx`/`Collab.tsx` don't use it (verified: no `user-follow` references in either file).

**Files:**
- Create: `backend/src/realtime/collabRelay.ts`
- Test: `backend/src/realtime/collabRelay.test.ts`

**Interfaces:**
- Produces: `attachCollabRelay(httpServer: http.Server): socketio.Server`, listening for `join-room`, `server-broadcast`, `server-volatile-broadcast`, `disconnecting`, and emitting `init-room`, `first-in-room`, `new-user`, `room-user-change`, `client-broadcast` — matching `excalidraw-app/collab/Portal.tsx`'s existing socket listeners exactly, so `Portal.tsx` needs no code changes.

- [ ] **Step 1: Write the failing test**

Create `backend/src/realtime/collabRelay.test.ts`:

```ts
import { createServer } from "http";

import { io as ioClient } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { attachCollabRelay } from "./collabRelay";

import type { AddressInfo } from "net";
import type { Server } from "socket.io";
import type { Socket as ClientSocket } from "socket.io-client";

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;
let clients: ClientSocket[] = [];

beforeEach(async () => {
  httpServer = createServer();
  io = attachCollabRelay(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
  clients = [];
});

afterEach(async () => {
  clients.forEach((client) => client.close());
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
    });
    client.on("connect", () => resolve(client));
    clients.push(client);
  });
}

describe("collab relay", () => {
  it("tells the first client in a room that it is first", async () => {
    const client = await connect();

    const firstInRoom = new Promise((resolve) =>
      client.on("first-in-room", resolve),
    );
    client.emit("join-room", "room-1");

    await expect(firstInRoom).resolves.toBeUndefined();
  });

  it("tells existing clients about a new joiner and updates room-user-change", async () => {
    const clientA = await connect();
    const clientB = await connect();

    await new Promise<void>((resolve) => {
      clientA.emit("join-room", "room-1");
      clientA.once("first-in-room", () => resolve());
    });

    const newUser = new Promise((resolve) => clientA.once("new-user", resolve));
    const roomUserChange = new Promise<string[]>((resolve) =>
      clientA.once("room-user-change", resolve),
    );

    clientB.emit("join-room", "room-1");

    await newUser;
    await expect(roomUserChange).resolves.toHaveLength(2);
  });

  it("relays server-broadcast to other clients in the room but not the sender", async () => {
    const clientA = await connect();
    const clientB = await connect();

    await new Promise<void>((resolve) => {
      clientA.emit("join-room", "room-1");
      clientA.once("first-in-room", () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientB.emit("join-room", "room-1");
      clientB.once("new-user", () => resolve());
    });

    const received = new Promise((resolve) =>
      clientB.once("client-broadcast", resolve),
    );
    let senderReceived = false;
    clientA.once("client-broadcast", () => {
      senderReceived = true;
    });

    clientA.emit("server-broadcast", "room-1", new ArrayBuffer(4), new Uint8Array([1]));

    await received;
    expect(senderReceived).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/realtime/collabRelay.test.ts`
Expected: FAIL — `Cannot find module './collabRelay'`.

- [ ] **Step 3: Implement `backend/src/realtime/collabRelay.ts`**

```ts
import { Server } from "socket.io";

import type { Server as HttpServer } from "http";

export function attachCollabRelay(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    io.to(socket.id).emit("init-room");

    socket.on("join-room", async (roomId: string) => {
      await socket.join(roomId);
      const sockets = await io.in(roomId).fetchSockets();

      if (sockets.length <= 1) {
        io.to(socket.id).emit("first-in-room");
      } else {
        socket.broadcast.to(roomId).emit("new-user", socket.id);
      }

      io.in(roomId).emit(
        "room-user-change",
        sockets.map((s) => s.id),
      );
    });

    socket.on(
      "server-broadcast",
      (roomId: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
        socket.broadcast.to(roomId).emit("client-broadcast", encryptedData, iv);
      },
    );

    socket.on(
      "server-volatile-broadcast",
      (roomId: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
        socket.volatile.broadcast
          .to(roomId)
          .emit("client-broadcast", encryptedData, iv);
      },
    );

    socket.on("disconnecting", async () => {
      for (const roomId of socket.rooms) {
        const otherSockets = (await io.in(roomId).fetchSockets()).filter(
          (s) => s.id !== socket.id,
        );
        if (otherSockets.length > 0) {
          socket.broadcast
            .to(roomId)
            .emit(
              "room-user-change",
              otherSockets.map((s) => s.id),
            );
        }
      }
    });

    socket.on("disconnect", () => {
      socket.removeAllListeners();
    });
  });

  return io;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/realtime/collabRelay.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/realtime/collabRelay.ts backend/src/realtime/collabRelay.test.ts
git commit -m "feat(backend): port excalidraw-room signaling relay"
```

---

## Task 8: Express app wiring, entrypoint, and Dockerfile

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/Dockerfile`
- Test: `backend/src/app.test.ts`

**Interfaces:**
- Consumes: `scenesRouter` (Task 3), `filesRouter` (Task 6), `attachCollabRelay` (Task 7), `env` (Task 2).
- Produces: `createApp(): express.Express` mounting `/api/scenes`, `/api/files`, `/health`; `backend/src/server.ts` as the process entrypoint used by the Dockerfile's `CMD`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/app.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("GET /health", () => {
  it("returns ok", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace backend vitest run src/app.test.ts`
Expected: FAIL — `Cannot find module './app'`.

- [ ] **Step 3: Implement `backend/src/app.ts`**

```ts
import express from "express";

import { filesRouter } from "./files/filesRouter";
import { scenesRouter } from "./scenes/scenesRouter";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/scenes", scenesRouter);
  app.use("/api/files", filesRouter);

  return app;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn workspace backend vitest run src/app.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implement `backend/src/server.ts`**

```ts
import { createServer } from "http";

import { createApp } from "./app";
import { env } from "./env";
import { attachCollabRelay } from "./realtime/collabRelay";

const app = createApp();
const httpServer = createServer(app);
attachCollabRelay(httpServer);

httpServer.listen(env.port, () => {
  console.log(`backend listening on port ${env.port}`);
});
```

- [ ] **Step 6: Create `backend/Dockerfile`**

Build context for this Dockerfile is the **repo root** (it needs the root `yarn.lock` and workspace layout), not `backend/`.

```dockerfile
FROM node:24-alpine AS build
WORKDIR /opt/node_app
COPY . .
RUN yarn --frozen-lockfile
RUN yarn workspace backend prisma:generate
RUN yarn workspace backend build

FROM node:24-alpine
WORKDIR /opt/node_app
ENV NODE_ENV=production
COPY --from=build /opt/node_app/node_modules ./node_modules
COPY --from=build /opt/node_app/backend/node_modules ./backend/node_modules
COPY --from=build /opt/node_app/backend/dist ./backend/dist
COPY --from=build /opt/node_app/backend/prisma ./backend/prisma
COPY --from=build /opt/node_app/backend/package.json ./backend/package.json
WORKDIR /opt/node_app/backend
EXPOSE 3010
HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3010/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

- [ ] **Step 7: Manually verify the whole backend runs end to end**

Run: `yarn workspace backend build && yarn workspace backend start` (with `backend/.env` from Task 1 pointing at the local Postgres, and a valid `GOOGLE_APPLICATION_CREDENTIALS`/`GCS_BUCKET`)
Expected: process logs `backend listening on port 3010`; `curl http://localhost:3010/health` returns `{"status":"ok"}`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.ts backend/src/server.ts backend/src/app.test.ts backend/Dockerfile
git commit -m "feat(backend): wire Express app, socket.io, and entrypoint"
```

---

## Task 9: Frontend `backend.ts` client module

Replaces `excalidraw-app/data/firebase.ts`. Must preserve the exact external contract Firebase's functions had (verified against `excalidraw-app/collab/Collab.tsx` and `excalidraw-app/data/FileManager.ts`):

- `isSceneSaved`/`isSavedToFirebase`: pure client-side cache check, no network call — the `WeakMap<Socket, number>` logic is ported as-is.
- `saveScene`/`saveToFirebase`: decrypts the previously-stored scene, reconciles with local elements via `reconcileElements` (same as before), and writes back. Firestore's transactional retry-on-conflict becomes an explicit read→reconcile→CAS-write retry loop against the new `PUT` endpoint's 409 response.
- `loadScene`/`loadFromFirebase`: fetch + decrypt, same return shape.
- `saveFiles`/`saveFilesToFirebase`: callers already pass fully encrypted+compressed buffers (from `encodeFilesForUpload`); this just base64-encodes and POSTs, returning `{savedFiles, erroredFiles}` (arrays of `FileId`).
- `loadFiles`/`loadFilesFromFirebase`: fetches raw blobs and decrypts them into `BinaryFileData` client-side, same as the Firebase version — the backend never sees plaintext.

**Files:**
- Create: `excalidraw-app/data/backend.ts`
- Test: `excalidraw-app/data/backend.test.ts`

**Interfaces:**
- Consumes: `getSyncableElements`, `SyncableExcalidrawElement` from `.` (existing `data/index.ts`); `Portal` type from `../collab/Portal`; `Socket` type from `socket.io-client`.
- Produces: `isSceneSaved(portal, elements): boolean`, `saveScene(portal, elements, appState): Promise<RemoteExcalidrawElement[] | null>`, `loadScene(roomId, roomKey, socket): Promise<readonly SyncableExcalidrawElement[] | null>`, `saveFiles({roomId, files}): Promise<{savedFiles: FileId[], erroredFiles: FileId[]}>`, `loadFiles(roomId, decryptionKey, fileIds): Promise<{loadedFiles: BinaryFileData[], erroredFiles: Map<FileId, true>}>`.

- [ ] **Step 1: Write the failing test**

Create `excalidraw-app/data/backend.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

import { isSceneSaved, saveFiles } from "./backend";

import type Portal from "../collab/Portal";

describe("isSceneSaved", () => {
  it("returns true when there is no active room", () => {
    const portal = { socket: null, roomId: null, roomKey: null } as Portal;

    expect(isSceneSaved(portal, [])).toBe(true);
  });
});

describe("saveFiles", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("posts base64-encoded files and returns the ids from the response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ savedFiles: ["file-1"], erroredFiles: [] }),
    } as Response);

    const result = await saveFiles({
      roomId: "room-1",
      files: [{ id: "file-1" as any, buffer: new Uint8Array([1, 2, 3]) }],
    });

    expect(result).toEqual({ savedFiles: ["file-1"], erroredFiles: [] });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/api/files/room-1");
    expect(JSON.parse(options!.body as string).files[0].fileId).toBe("file-1");
  });

  it("treats a failed request as every file erroring", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    const result = await saveFiles({
      roomId: "room-1",
      files: [{ id: "file-1" as any, buffer: new Uint8Array([1]) }],
    });

    expect(result).toEqual({ savedFiles: [], erroredFiles: ["file-1"] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:app backend.test.ts`
Expected: FAIL — `Cannot find module './backend'`.

- [ ] **Step 3: Implement `excalidraw-app/data/backend.ts`**

```ts
import { reconcileElements } from "@excalidraw/excalidraw";
import { toBrandedType, MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_APP_BACKEND_URL;

type StoredSceneResponse = { ciphertext: string; iv: string; revision: number };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const array = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: StoredSceneResponse,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = base64ToBytes(data.ciphertext);
  const iv = base64ToBytes(data.iv);
  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decoded = new TextDecoder("utf-8").decode(new Uint8Array(decrypted));
  return JSON.parse(decoded);
};

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => SceneVersionCache.cache.get(socket);
  static set = (socket: Socket, elements: readonly SyncableExcalidrawElement[]) => {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSceneSaved = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    return SceneVersionCache.get(portal.socket) === getSceneVersion(elements);
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

const fetchStoredScene = async (
  roomId: string,
): Promise<StoredSceneResponse | null> => {
  const response = await fetch(`${BACKEND_URL}/api/scenes/${roomId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`failed to load scene: ${response.status}`);
  }
  return response.json();
};

export const saveScene = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (!roomId || !roomKey || !socket || isSceneSaved(portal, elements)) {
    return null;
  }

  let localElements = elements;

  // mirrors Firestore's transactional retry: read, reconcile, try to write,
  // and retry against the fresher scene if another collaborator won the race
  for (let attempt = 0; attempt < 5; attempt++) {
    const stored = await fetchStoredScene(roomId);

    let reconciled: SyncableExcalidrawElement[];
    let expectedRevision: number;

    if (!stored) {
      reconciled = getSyncableElements(
        localElements as unknown as OrderedExcalidrawElement[],
      );
      expectedRevision = 0;
    } else {
      const prevElements = getSyncableElements(
        restoreElements(await decryptElements(stored, roomKey), null),
      );
      reconciled = getSyncableElements(
        reconcileElements(
          localElements,
          prevElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
          appState,
        ),
      );
      expectedRevision = stored.revision;
    }

    const { ciphertext, iv } = await encryptElements(roomKey, reconciled);

    const response = await fetch(`${BACKEND_URL}/api/scenes/${roomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: bytesToBase64(ciphertext),
        iv: bytesToBase64(iv),
        expectedRevision,
      }),
    });

    if (response.status === 409) {
      const { current } = await response.json();
      localElements = getSyncableElements(
        restoreElements(
          await decryptElements(current, roomKey),
          null,
        ) as OrderedExcalidrawElement[],
      ) as unknown as readonly SyncableExcalidrawElement[];
      continue;
    }

    if (!response.ok) {
      throw new Error(`failed to save scene: ${response.status}`);
    }

    SceneVersionCache.set(socket, reconciled);
    return toBrandedType<RemoteExcalidrawElement[]>(reconciled);
  }

  throw new Error("failed to save scene after retrying (too many concurrent edits)");
};

export const loadScene = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const stored = await fetchStoredScene(roomId);
  if (!stored) {
    return null;
  }

  const elements = getSyncableElements(
    restoreElements(await decryptElements(stored, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    SceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const saveFiles = async ({
  roomId,
  files,
}: {
  roomId: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const response = await fetch(`${BACKEND_URL}/api/files/${roomId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map(({ id, buffer }) => ({
        fileId: id,
        data: bytesToBase64(buffer),
      })),
    }),
  });

  if (!response.ok) {
    return { savedFiles: [] as FileId[], erroredFiles: files.map((f) => f.id) };
  }

  const { savedFiles, erroredFiles } = await response.json();
  return { savedFiles: savedFiles as FileId[], erroredFiles: erroredFiles as FileId[] };
};

export const loadFiles = async (
  roomId: string,
  decryptionKey: string,
  fileIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length === 0) {
    return { loadedFiles, erroredFiles };
  }

  const response = await fetch(
    `${BACKEND_URL}/api/files/${roomId}?ids=${uniqueIds.join(",")}`,
  );

  if (!response.ok) {
    uniqueIds.forEach((id) => erroredFiles.set(id, true));
    return { loadedFiles, erroredFiles };
  }

  const { loadedFiles: rawFiles, erroredFiles: rawErrored } = await response.json();

  (rawErrored as string[]).forEach((id) => erroredFiles.set(id as FileId, true));

  await Promise.all(
    (rawFiles as { fileId: string; data: string }[]).map(async ({ fileId, data }) => {
      try {
        const { data: decoded, metadata } = await decompressData<BinaryFileMetadata>(
          base64ToBytes(data),
          { decryptionKey },
        );
        const dataURL = new TextDecoder().decode(decoded) as DataURL;
        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id: fileId as FileId,
          dataURL,
          created: metadata?.created || Date.now(),
          lastRetrieved: metadata?.created || Date.now(),
        });
      } catch {
        erroredFiles.set(fileId as FileId, true);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:app backend.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add excalidraw-app/data/backend.ts excalidraw-app/data/backend.test.ts
git commit -m "feat(app): add backend.ts client replacing firebase.ts"
```

---

## Task 10: Rewire Collab.tsx to `backend.ts`

`excalidraw-app/data/firebase.ts` itself is **not** deleted in this task — `excalidraw-app/data/index.ts` and `excalidraw-app/components/ExportToExcalidrawPlus.tsx` still import from it, and those are only cleaned up in Tasks 11 and 12. Deleting it here would break typecheck. It is deleted as the final step of Task 12, once nothing imports it anymore.

**Files:**
- Modify: `excalidraw-app/collab/Collab.tsx:79-84,165,173-174`
- Modify: `excalidraw-app/vite-env.d.ts:8-9,18` (do not remove `VITE_APP_FIREBASE_CONFIG` yet — `firebase.ts` still reads it until Task 12; just add `VITE_APP_BACKEND_URL` alongside it)
- Modify: `.env.development`, `.env.production`, `.env.test` (add `VITE_APP_BACKEND_URL` and point `VITE_APP_WS_SERVER_URL` at the new backend; leave `VITE_APP_FIREBASE_CONFIG` in place for now)
- Modify: `excalidraw-app/tests/collab.test.tsx` (mocks)

**Interfaces:**
- Consumes: `isSceneSaved`, `loadFiles`, `loadScene`, `saveFiles`, `saveScene` from `../data/backend` (Task 9).

- [ ] **Step 1: Update the import in `Collab.tsx`**

Replace `excalidraw-app/collab/Collab.tsx:79-84`:

```ts
  isSavedToFirebase,
  loadFilesFromFirebase,
  loadFromFirebase,
  saveFilesToFirebase,
  saveToFirebase,
} from "../data/firebase";
```

with:

```ts
  isSceneSaved,
  loadFiles,
  loadScene,
  saveFiles,
  saveScene,
} from "../data/backend";
```

- [ ] **Step 2: Update every call site in `Collab.tsx`**

Rename call sites to match: `isSavedToFirebase` → `isSceneSaved` (line 307), `saveToFirebase` → `saveScene` (line 328), `loadFromFirebase` → `loadScene` (line 734), `saveCollabRoomToFirebase` calls stay as-is (that's a local method name, not renamed).

Replace `excalidraw-app/collab/Collab.tsx:165`:

```ts
        return loadFilesFromFirebase(`files/rooms/${roomId}`, roomKey, fileIds);
```

with:

```ts
        return loadFiles(roomId, roomKey, fileIds);
```

Replace `excalidraw-app/collab/Collab.tsx:173-174`:

```ts
        const { savedFiles, erroredFiles } = await saveFilesToFirebase({
          prefix: `${FIREBASE_STORAGE_PREFIXES.collabFiles}/${roomId}`,
```

with:

```ts
        const { savedFiles, erroredFiles } = await saveFiles({
          roomId,
```

Remove the now-unused `FIREBASE_STORAGE_PREFIXES` import from `Collab.tsx` (check with `grep -n "FIREBASE_STORAGE_PREFIXES" excalidraw-app/collab/Collab.tsx` — it should now only appear in the import line; delete that import line).

- [ ] **Step 2: Update `excalidraw-app/vite-env.d.ts`**

Add, alongside the existing `VITE_APP_FIREBASE_CONFIG: string;` (leave that line in place — `firebase.ts` still reads it until Task 12):

```ts
  VITE_APP_BACKEND_URL: string;
```

- [ ] **Step 3: Update env files**

In `.env.development`, `.env.production`, `.env.test`: update `VITE_APP_WS_SERVER_URL` to point at the new backend (e.g. `http://localhost:3010` for development), and add `VITE_APP_BACKEND_URL=http://localhost:3010` (development) / the real deployed backend origin (production). Leave `VITE_APP_FIREBASE_CONFIG` untouched for now.

- [ ] **Step 4: Update `excalidraw-app/tests/collab.test.tsx` mocks**

Run: `grep -n "firebase" excalidraw-app/tests/collab.test.tsx`

Update any `vi.mock("../data/firebase", ...)` to `vi.mock("../data/backend", ...)` with the corresponding new function names (`isSceneSaved`, `loadFiles`, `loadScene`, `saveFiles`, `saveScene`).

- [ ] **Step 5: Type-check and run tests**

Run: `yarn test:typecheck`
Expected: no errors.

Run: `yarn test:app collab.test.tsx`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `yarn workspace backend start` (backend from Task 8) and `yarn start` (frontend) locally. Open the app in two browser tabs, start a collaboration session in tab 1, copy the link into tab 2. Draw a shape in tab 1 and confirm it appears in tab 2 within ~1 second. Reload tab 2 and confirm the scene persists (round-trips through Postgres).

- [ ] **Step 7: Commit**

```bash
git add excalidraw-app/collab/Collab.tsx excalidraw-app/vite-env.d.ts .env.development .env.production .env.test excalidraw-app/tests/collab.test.tsx
git commit -m "feat(app): rewire live collaboration to the self-hosted backend"
```

---

## Task 11: Remove "Export to a link" (static share) feature

This feature (`#json=id,key` URLs, backed by `VITE_APP_BACKEND_V2_GET_URL`/`_POST_URL` plus Firebase Storage) is unrelated to live collaboration and was confirmed unneeded. Removing it eliminates one of the two remaining call sites of `firebase.ts` (`data/index.ts:39` imported `saveFilesToFirebase`); the other (`ExportToExcalidrawPlus.tsx`) is removed in Task 12, which also deletes `firebase.ts` itself.

**Files:**
- Modify: `excalidraw-app/data/index.ts` (remove `exportToBackend`, `importFromBackend`, `legacy_decodeFromBackend`, `BACKEND_V2_GET`/`BACKEND_V2_POST`, the `saveFilesToFirebase` import)
- Modify: `excalidraw-app/App.tsx` (remove `jsonBackendMatch` handling, `onExportToBackend`, `latestShareableLink`, `ShareableLinkDialog` usage)
- Modify: `excalidraw-app/share/ShareDialog.tsx` (remove `onExportToBackend` prop and the "export to link" button)
- Modify: `excalidraw-app/vite-env.d.ts` (remove `VITE_APP_BACKEND_V2_GET_URL`/`_POST_URL`)
- Modify: `.env.development`, `.env.production`, `.env.test` (remove those two vars)

- [ ] **Step 1: Trim `excalidraw-app/data/index.ts`**

Remove the import at line 39 (`import { saveFilesToFirebase } from "./firebase";`) and the two consts at lines 65-66 (`BACKEND_V2_GET`, `BACKEND_V2_POST`).

Delete the `legacy_decodeFromBackend` function (around line 170) and the `importFromBackend`/`exportToBackend`/`ExportToBackendResult` definitions (around lines 202-300) in their entirety — run `grep -n "legacy_decodeFromBackend\|importFromBackend\|exportToBackend\|ExportToBackendResult" excalidraw-app/data/index.ts` first and delete every matching block found.

- [ ] **Step 2: Trim `excalidraw-app/App.tsx` — imports**

Remove `exportToBackend` and `importFromBackend` from the import list around line 112-114, and remove the `ShareableLinkDialog` import at line 20.

- [ ] **Step 3: Trim `excalidraw-app/App.tsx` — `initializeScene`**

In the `initializeScene` function (around line 217-373):

- Remove the `id`/`jsonBackendMatch` extraction (lines 227-230).
- Change line 251 from `const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);` to `const isExternalScene = !!roomLinkData;`.
- Remove the `if (jsonBackendMatch) { ... }` block (lines 261-282) that calls `importFromBackend`.
- Change the ternary at lines 362-370 from:

```ts
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
```

to:

```ts
  } else if (scene) {
    return { scene, isExternalScene: false };
  }
```

Leave the `externalUrlMatch`/`#url=` branch (line 304 onward) untouched — that's the unrelated "import from URL" feature.

- [ ] **Step 4: Trim `excalidraw-app/App.tsx` — the `data.isExternalScene` file-loading branch**

Around line 500-530, the `else` branch of `if (collabAPI?.isCollaborating())` calls `loadFilesFromFirebase` under `data.isExternalScene`. Since `isExternalScene` can now only be true via `roomLinkData` (live collab, already handled elsewhere), and the static-share code path it served is gone, delete the `if (data.isExternalScene) { ... }` block that calls `loadFilesFromFirebase`/`FileStatusStore.updateStatuses` for the removed feature, leaving the surrounding `else` branch's other logic (if any) intact. Run `grep -n "loadFilesFromFirebase\|FIREBASE_STORAGE_PREFIXES" excalidraw-app/App.tsx` afterward to confirm no references remain, then remove the now-unused `FIREBASE_STORAGE_PREFIXES` import.

- [ ] **Step 5: Trim `excalidraw-app/App.tsx` — export-to-backend wiring**

Remove the `latestShareableLink` state (around line 767-769), the `onExportToBackend` function (around line 771-809), the `onExportToBackend` entry inside `UIOptions.canvasActions.export` (around line 960), and the `<ShareableLinkDialog ... />` block (around line 1075-1081).

Change the `<ShareDialog ... />` usage (around line 1086-1101) from:

```tsx
        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />
```

to:

```tsx
        <ShareDialog collabAPI={collabAPI} />
```

- [ ] **Step 6: Trim `excalidraw-app/share/ShareDialog.tsx`**

Remove `type OnExportToBackend = () => void;` (line 29) and `onExportToBackend: OnExportToBackend;` from `ShareDialogProps` (line 53) and from the `ShareDialog` component's own props type (lines 267-270). Remove the `onExportToBackend={props.onExportToBackend}` prop pass (line 289).

Remove the separator + "export to link" JSX block inside `ShareDialogPicker` (lines 209-213 and 221-242), so the function body becomes:

```tsx
  return <>{startCollabJSX}</>;
```

- [ ] **Step 7: Remove the now-unused backend-v2 env vars**

Remove `VITE_APP_BACKEND_V2_GET_URL: string;` and `VITE_APP_BACKEND_V2_POST_URL: string;` from `excalidraw-app/vite-env.d.ts`, and the corresponding lines from `.env.development`, `.env.production`, `.env.test`.

- [ ] **Step 8: Type-check**

Run: `yarn test:typecheck`
Expected: no errors. Fix any remaining dangling references reported by the compiler (e.g. an unused-import lint warning is fine; a type error means a reference was missed).

- [ ] **Step 9: Manual verification**

Run the app locally (`yarn start`). Open the Share dialog — it should show only the "Start collaboration" option, no "link" export option. Open the canvas export dialog (toolbar → export) — it should no longer show a "link" export option.

- [ ] **Step 10: Commit**

```bash
git add excalidraw-app/data/index.ts excalidraw-app/App.tsx excalidraw-app/share/ShareDialog.tsx excalidraw-app/vite-env.d.ts .env.development .env.production .env.test
git commit -m "feat(app): remove unused 'Export to a link' static-share feature"
```

---

## Task 12: Remove "Export to Excalidraw+" feature

This is the last task with a call site into `firebase.ts` (`ExportToExcalidrawPlus.tsx` imports `loadFirebaseStorage`, `saveFilesToFirebase`) — once it's removed, nothing imports `firebase.ts` (Task 10 rewired `Collab.tsx`, Task 11 removed `data/index.ts`'s import), so this task also deletes `firebase.ts` itself and its remaining config.

**Files:**
- Modify: `excalidraw-app/App.tsx` (remove `renderCustomUI` wiring)
- Delete: `excalidraw-app/components/ExportToExcalidrawPlus.tsx`
- Delete: `excalidraw-app/components/ExportToExcalidrawPlus.scss` (if present)
- Delete: `excalidraw-app/data/firebase.ts`
- Modify: `excalidraw-app/vite-env.d.ts` (remove `VITE_APP_FIREBASE_CONFIG`)
- Modify: `excalidraw-app/package.json` (remove `firebase` dependency)
- Modify: `.env.development`, `.env.production`, `.env.test` (remove `VITE_APP_FIREBASE_CONFIG`)

- [ ] **Step 1: Remove the `renderCustomUI` wiring in `excalidraw-app/App.tsx`**

Around line 961-970 (inside `UIOptions.canvasActions.export`), remove the `renderCustomUI: excalidrawAPI ? (elements, appState, files) => { return <ExportToExcalidrawPlus ... /> } : undefined` property entirely, and remove the `ExportToExcalidrawPlus` import.

- [ ] **Step 2: Delete the component**

Run: `git rm excalidraw-app/components/ExportToExcalidrawPlus.tsx excalidraw-app/components/ExportToExcalidrawPlus.scss` (omit the `.scss` path if it doesn't exist — check with `ls excalidraw-app/components/ | grep ExportToExcalidrawPlus` first).

- [ ] **Step 3: Confirm nothing else imports `firebase.ts`, then delete it**

Run: `grep -rn "from \"\\.\\./data/firebase\"\|from \"\\./firebase\"" excalidraw-app`
Expected: no output (Tasks 10-11 already removed the other call sites).

Run: `git rm excalidraw-app/data/firebase.ts`

- [ ] **Step 4: Remove the now-unused Firebase config**

Remove `VITE_APP_FIREBASE_CONFIG: string;` from `excalidraw-app/vite-env.d.ts`, remove the `VITE_APP_FIREBASE_CONFIG=...` line from `.env.development`, `.env.production`, `.env.test`, and remove the `"firebase": "11.3.1",` line from `excalidraw-app/package.json`'s `dependencies`.

Run: `yarn install`
Expected: `firebase` removed from `yarn.lock` and `node_modules`.

- [ ] **Step 5: Type-check**

Run: `yarn test:typecheck`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Open the canvas export dialog in the running app — the "Excalidraw+" export option should no longer appear. Re-run the two-tab collaboration check from Task 10 to confirm removing `firebase.ts` and its config didn't regress collaboration.

- [ ] **Step 7: Commit**

```bash
git add excalidraw-app/App.tsx excalidraw-app/vite-env.d.ts excalidraw-app/package.json .env.development .env.production .env.test
git rm excalidraw-app/data/firebase.ts excalidraw-app/components/ExportToExcalidrawPlus.tsx
git commit -m "feat(app): remove Export to Excalidraw+ and delete firebase.ts"
```

---

## Task 13: Production deployment (docker-compose + nginx)

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `nginx.conf`
- Modify: `Dockerfile:16-20` (copy the new nginx config)
- Create: `.env.prod.example`

**Interfaces:**
- Produces: a 3-container stack (`postgres`, `backend`, `excalidraw`) where only `excalidraw` (nginx) exposes a port, and nginx reverse-proxies `/api/*` and `/socket.io/*` to `backend`.

- [ ] **Step 1: Create `nginx.conf`**

```nginx
server {
  listen 80;

  location /socket.io/ {
    proxy_pass http://backend:3010/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /api/ {
    proxy_pass http://backend:3010/api/;
    proxy_set_header Host $host;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Update `Dockerfile`**

Modify `Dockerfile:16-20` from:

```dockerfile
FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
```

to:

```dockerfile
FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
```

- [ ] **Step 3: Create `.env.prod.example`**

```
POSTGRES_PASSWORD=change-me
GCS_BUCKET=your-bucket-name
```

- [ ] **Step 4: Create `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=excalidraw
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=excalidraw
    volumes:
      - postgres-data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      - PORT=3010
      - DATABASE_URL=postgresql://excalidraw:${POSTGRES_PASSWORD}@postgres:5432/excalidraw
      - GCS_BUCKET=${GCS_BUCKET}
      - GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcs-key.json
    volumes:
      - ./gcs-key.json:/secrets/gcs-key.json:ro

  excalidraw:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  postgres-data:
```

- [ ] **Step 5: Verify the stack builds and serves traffic locally**

Run: `cp .env.prod.example .env.prod` (fill in real `POSTGRES_PASSWORD`/`GCS_BUCKET`), then `docker compose --env-file .env.prod -f docker-compose.prod.yml up --build`
Expected: all three containers start; `curl http://localhost/` returns the app's HTML; `curl http://localhost/api/scenes/does-not-exist` returns 404 JSON (proxy reaches `backend`).

- [ ] **Step 6: Manual end-to-end verification**

With the stack running, open `http://localhost/` in two browser tabs, start a collaboration session, and confirm live sync and reload-persistence work the same as in Task 10's local verification — this time through nginx's reverse proxy instead of hitting the backend directly.

- [ ] **Step 7: Commit**

```bash
git add nginx.conf Dockerfile docker-compose.prod.yml .env.prod.example
git commit -m "feat(deploy): add production docker-compose stack with nginx reverse proxy"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Task 8), data model (Tasks 1-2), REST API (Tasks 3, 6), socket protocol (Task 7), frontend integration (Tasks 9-10), the two "hide this feature" decisions (Tasks 11-12), deployment (Task 13), error handling (409 retry in Task 9, per-file error arrays in Tasks 6/9) — all covered.
- **Deviation from the approved spec, called out explicitly:** the spec described save conflicts as "write only if `sceneVersion` is greater"; while implementing Task 2/9 it became clear Firestore's actual mechanism is a transactional read-reconcile-write, which requires real compare-and-swap (a `revision` counter) plus a client-side retry loop, not a simple version comparison. This plan implements the CAS+retry version, which preserves the spec's intent (no collaborator's edits silently clobbered) more precisely than the original wording.
- **Scope found during planning, resolved with the user:** two additional Firebase-dependent features (`ExportToExcalidrawPlus.tsx`, and the previously-undiscovered "Export to a link" static-share feature in `data/index.ts`/`App.tsx`) were found to share `firebase.ts`'s functions. Both were confirmed unneeded and are removed in Tasks 11-12.
- **Pre-flight fix (before dispatch):** the original Task 10 deleted `firebase.ts` immediately after rewiring `Collab.tsx`, but `data/index.ts` (Task 11) and `ExportToExcalidrawPlus.tsx` (Task 12) still imported from it at that point — deleting it in Task 10 would have broken typecheck mid-plan. Fixed by moving the deletion (and the `VITE_APP_FIREBASE_CONFIG`/`firebase` dependency cleanup) to the end of Task 12, the last task with a remaining call site.
