# Database (MongoDB)

Everything lives in one database (`MONGODB_DB`, default `excalidraw_workspace`). Collections are created with a `$jsonSchema` validator (`validationLevel: moderate`, `validationAction: error`) and their indexes on every server start, idempotently (`server/src/db.ts › initializeSchema`). MongoDB Compass can browse and edit everything normally.

References are plain `ObjectId` fields (no joins); deletes cascade in application code (workspace → scenes/folders/libraries; scene → permissions, share links, comments, files).

## Collections

| Collection | Purpose | Notable indexes |
| --- | --- | --- |
| `users` | Accounts: `email`, `emailLower`, `passwordHash` (scrypt), `displayName`, `avatarUrl`, `status` (`active`/`disabled`), timestamps, `lastLoginAt` | `emailLower` **unique** |
| `sessions` | Server-side sessions. Only an HMAC of the cookie token is stored | `tokenHash` **unique**, `expiresAt` **TTL**, `userId` |
| `workspaces` | `name`, `slug`, `ownerId` | `slug` **unique** |
| `workspace_members` | `workspaceId`, `userId`, `role` (`OWNER`/`ADMIN`/`MEMBER`) | `(workspaceId,userId)` **unique**, `userId` |
| `folders` | Nested folders: `parentId`, `name`, `nameLower` | `(workspaceId,parentId,nameLower)` **unique** |
| `scenes` | `data` (`{elements, appState}` in Excalidraw's format), `thumbnail`, `textContent` (for search), `fileIds`, `visibility`, `version`, `deletedAt` (trash) | `(workspaceId,deletedAt,updatedAt)`, `(workspaceId,folderId,deletedAt)`, `(workspaceId,ownerId,deletedAt)` |
| `scene_permissions` | Per-user grants: `sceneId`, `userId`, `level` (`VIEW`/`EDIT`) | `(sceneId,userId)` **unique**, `userId` |
| `share_links` | `tokenHash` (HMAC, lookup), `tokenEnc` (AES-GCM, so owners can re-copy), `level`, `expiresAt`, `revokedAt` | `tokenHash` **unique**, `sceneId` |
| `comments` | Threads (`parentId` = null) and replies, `positionX/Y`, optional `elementId`, `resolvedAt` | `(sceneId,createdAt)` |
| `libraries`, `library_items` | Personal and workspace libraries; items in Excalidraw's library-item shape | `(kind,ownerId)` **unique**, `(libraryId,itemId)` **unique** |
| `ai_settings` | Per-workspace provider/model, encrypted key (`apiKeyEnc`), limits, allow-list | `workspaceId` **unique** |
| `ai_usage` | Daily counters (`scope`: workspace/user, `day`) | unique `(workspaceId,scope,userId,day)`, `expiresAt` **TTL** |
| `api_keys` | Hashed keys (`prefix`, `secretHash`), `scopes`, `kind`, `expiresAt`, `revokedAt` | `prefix` **unique** |
| `audit_logs` | Sensitive actions with redacted metadata | `createdAt`, `(workspaceId,createdAt)`, `(actorId,createdAt)` |

## Why these shapes

- **Scene documents are self-contained.** The whole scene is one document, so a load is one read and a save is one atomic conditional update. The 16 MB document limit is enforced well below that: the API refuses scenes over 10 MB (`413 scene_too_large`). Image bytes are kept out of the document.
- **Optimistic concurrency, not locks.** `PUT /scenes/:id/data` is `findOneAndUpdate({_id, version: baseVersion}) + $inc: {version: 1}`. A stale writer matches nothing and gets the current copy back (`409`). Two racing saves: exactly one wins (covered by a test).
- **Dashboards never load drawings.** List queries project `data` and `textContent` away, sort on indexed fields, and page with `limit`/`offset`. Thumbnails are served separately with `ETag`s.
- **Search** is a case-insensitive, regex-escaped match over the scene name, extracted canvas text, folder names and owner names. It is intentionally simple; a text index is a drop-in upgrade.
- **TTL indexes** clean up expired sessions and AI usage rows without cron jobs. Trashed scenes are purged by an hourly sweep (`TRASH_RETENTION_DAYS`, default 30) because their files must be deleted too.
- **Atomic quotas.** AI limits use a conditional `$inc` upsert (`count < limit`); a full counter collides with the unique index, which is how "limit reached" is detected without a race.

## Inspecting and backing up

```bash
mongosh excalidraw_workspace --eval 'db.scenes.find({}, {name:1, version:1, sizeBytes:1}).limit(5)'
mongodump --db excalidraw_workspace --out ./backup           # data (images are in STORAGE_PATH or your bucket)
mongorestore --db excalidraw_workspace ./backup/excalidraw_workspace
```

Back up the storage location too: scene documents reference images by id only.
