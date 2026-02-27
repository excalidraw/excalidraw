# Excalidraw MongoDB Backend API Contract

## Overview

This document defines the API contract between the Excalidraw frontend and the MongoDB backend server for room persistence and collaboration features.

**Base URL**: Configured via `VITE_APP_MONGODB_BACKEND_URL` environment variable

**Authentication**: None (client-side encryption ensures data privacy)

**Content Type**: `application/json` for JSON data, `application/octet-stream` for binary data

---

## Room Data Endpoints

### 1. Get Room Data

Retrieves encrypted room scene data from MongoDB.

**Endpoint**: `GET /api/rooms/:roomId`

**Parameters**:
- `roomId` (string, URL parameter): Unique room identifier (10-byte hex string)

**Response** (Success - 200 OK):
```json
{
  "roomId": "a1b2c3d4e5f6789012",
  "displayName": "My Project Room",
  "data": {
    "iv": "base64-encoded-iv",
    "ciphertext": "base64-encoded-encrypted-data"
  },
  "sceneVersion": 15,
  "createdAt": "2026-02-27T08:00:00.000Z",
  "updatedAt": "2026-02-27T10:30:00.000Z",
  "lastAccessedAt": "2026-02-27T10:30:00.000Z"
}
```

**Response** (Not Found - 404):
```json
{
  "error": "Room not found",
  "roomId": "a1b2c3d4e5f6789012"
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

### 2. Save/Update Room Data

Saves or updates encrypted room scene data in MongoDB.

**Endpoint**: `POST /api/rooms/:roomId`

**Parameters**:
- `roomId` (string, URL parameter): Unique room identifier

**Request Body**:
```json
{
  "iv": "base64-encoded-iv",
  "ciphertext": "base64-encoded-encrypted-data",
  "sceneVersion": 16,
  "displayName": "My Project Room (optional)"
}
```

**Response** (Success - 200 OK):
```json
{
  "success": true,
  "roomId": "a1b2c3d4e5f6789012",
  "sceneVersion": 16,
  "updatedAt": "2026-02-27T10:31:00.000Z"
}
```

**Response** (Bad Request - 400):
```json
{
  "error": "Invalid request",
  "message": "Missing required fields: iv, ciphertext"
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

## File Storage Endpoints

### 3. Upload File

Uploads an encrypted file (image) to MongoDB GridFS.

**Endpoint**: `POST /api/files/:prefix/:fileId`

**Parameters**:
- `prefix` (string, URL parameter): Storage prefix path (e.g., `rooms/a1b2c3`, `shareLinks/xyz789`)
- `fileId` (string, URL parameter): Unique file identifier

**Headers**:
- `Content-Type`: `application/octet-stream`

**Request Body**: Binary file data (raw bytes)

**Response** (Success - 200 OK):
```json
{
  "success": true,
  "fileId": "file-abc123",
  "prefix": "rooms/a1b2c3",
  "size": 245678,
  "uploadedAt": "2026-02-27T10:32:00.000Z"
}
```

**Response** (Payload Too Large - 413):
```json
{
  "error": "File too large",
  "maxSize": 4194304,
  "receivedSize": 5242880
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

### 4. Download File

Downloads an encrypted file (image) from MongoDB GridFS.

**Endpoint**: `GET /api/files/:prefix/:fileId`

**Parameters**:
- `prefix` (string, URL parameter): Storage prefix path
- `fileId` (string, URL parameter): Unique file identifier

**Response** (Success - 200 OK):
- **Headers**:
  - `Content-Type`: `application/octet-stream`
  - `Cache-Control`: `public, max-age=31536000` (1 year)
  - `Content-Length`: File size in bytes
- **Body**: Binary file data (raw bytes)

**Response** (Not Found - 404):
```json
{
  "error": "File not found",
  "fileId": "file-abc123",
  "prefix": "rooms/a1b2c3"
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

### 5. Get Multiple Files Metadata

Retrieves metadata for multiple files (used to check which files exist).

**Endpoint**: `POST /api/files/metadata`

**Request Body**:
```json
{
  "files": [
    {
      "prefix": "rooms/a1b2c3",
      "fileId": "file-abc123"
    },
    {
      "prefix": "rooms/a1b2c3",
      "fileId": "file-def456"
    }
  ]
}
```

**Response** (Success - 200 OK):
```json
{
  "files": [
    {
      "fileId": "file-abc123",
      "prefix": "rooms/a1b2c3",
      "exists": true,
      "size": 245678
    },
    {
      "fileId": "file-def456",
      "prefix": "rooms/a1b2c3",
      "exists": false
    }
  ]
}
```

---

## Room Metadata Endpoints

### 6. List All Rooms

Retrieves metadata for all available rooms (for room browser/list).

**Endpoint**: `GET /api/rooms`

**Query Parameters** (optional):
- `limit` (number): Maximum number of rooms to return (default: 100)
- `offset` (number): Pagination offset (default: 0)
- `sortBy` (string): Sort field - `updatedAt`, `createdAt`, `displayName` (default: `updatedAt`)
- `sortOrder` (string): `asc` or `desc` (default: `desc`)

**Response** (Success - 200 OK):
```json
{
  "rooms": [
    {
      "roomId": "a1b2c3d4e5f6789012",
      "displayName": "My Project Room",
      "createdAt": "2026-02-27T08:00:00.000Z",
      "updatedAt": "2026-02-27T10:30:00.000Z",
      "lastAccessedAt": "2026-02-27T10:30:00.000Z",
      "isActive": true
    },
    {
      "roomId": "xyz789abc456def012",
      "displayName": "Team Brainstorm Session",
      "createdAt": "2026-02-26T14:00:00.000Z",
      "updatedAt": "2026-02-26T16:45:00.000Z",
      "lastAccessedAt": "2026-02-27T09:15:00.000Z",
      "isActive": false
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

### 7. Get Room Metadata

Retrieves only the metadata for a specific room (without scene data).

**Endpoint**: `GET /api/rooms/:roomId/metadata`

**Parameters**:
- `roomId` (string, URL parameter): Unique room identifier

**Response** (Success - 200 OK):
```json
{
  "roomId": "a1b2c3d4e5f6789012",
  "displayName": "My Project Room",
  "createdAt": "2026-02-27T08:00:00.000Z",
  "updatedAt": "2026-02-27T10:30:00.000Z",
  "lastAccessedAt": "2026-02-27T10:30:00.000Z",
  "sceneVersion": 15
}
```

**Response** (Not Found - 404):
```json
{
  "error": "Room not found",
  "roomId": "a1b2c3d4e5f6789012"
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

### 8. Update Room Metadata

Updates the display name or other metadata for a room.

**Endpoint**: `PUT /api/rooms/:roomId/metadata`

**Parameters**:
- `roomId` (string, URL parameter): Unique room identifier

**Request Body**:
```json
{
  "displayName": "Updated Room Name"
}
```

**Response** (Success - 200 OK):
```json
{
  "success": true,
  "roomId": "a1b2c3d4e5f6789012",
  "displayName": "Updated Room Name",
  "updatedAt": "2026-02-27T11:00:00.000Z"
}
```

**Response** (Bad Request - 400):
```json
{
  "error": "Invalid request",
  "message": "Display name must be between 1 and 100 characters"
}
```

**Response** (Not Found - 404):
```json
{
  "error": "Room not found",
  "roomId": "a1b2c3d4e5f6789012"
}
```

**Response** (Server Error - 500):
```json
{
  "error": "Internal server error",
  "message": "Error description"
}
```

---

## Data Structures

### Room Data Storage (MongoDB)

```javascript
{
  _id: ObjectId,
  roomId: String,        // Unique room identifier (indexed)
  displayName: String,   // Human-readable room name (max 100 chars)
  iv: Buffer,            // Initialization vector for encryption
  ciphertext: Buffer,    // Encrypted scene data
  sceneVersion: Number,  // Scene version for conflict resolution
  createdAt: Date,       // Room creation timestamp
  updatedAt: Date,       // Last update timestamp
  lastAccessedAt: Date   // Last time room was accessed
}
```

**Index**: `{ roomId: 1 }` (unique)

### File Storage (MongoDB GridFS)

Files are stored in GridFS with metadata:

```javascript
{
  _id: ObjectId,
  filename: String,      // Format: "{prefix}/{fileId}"
  length: Number,        // File size in bytes
  chunkSize: Number,     // GridFS chunk size
  uploadDate: Date,      // Upload timestamp
  metadata: {
    prefix: String,      // Storage prefix
    fileId: String,      // File identifier
    encrypted: Boolean   // Always true for Excalidraw
  }
}
```

---

## Security Considerations

1. **Client-Side Encryption**: All room data and files are encrypted on the client before transmission
2. **No Authentication**: Backend stores encrypted data without access to decryption keys
3. **Rate Limiting**: Backend should implement rate limiting to prevent abuse
4. **File Size Limits**: Maximum file size is 4 MB (FILE_UPLOAD_MAX_BYTES)
5. **CORS**: Backend must allow requests from Excalidraw frontend domains

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE" // Optional error code
}
```

**Common HTTP Status Codes**:
- `200 OK`: Success
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `413 Payload Too Large`: File exceeds size limit
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server failure

---

## Environment Variables

### Frontend (.env.development / .env.production)

```bash
# MongoDB Backend API URL
VITE_APP_MONGODB_BACKEND_URL=http://localhost:3003

# WebSocket Server (unchanged)
VITE_APP_WS_SERVER_URL=http://localhost:3002
```

### Backend

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/excalidraw

# Server Configuration
PORT=3003
NODE_ENV=development

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# File Upload Limits
MAX_FILE_SIZE=4194304  # 4MB in bytes
```

---

## Migration Notes

### Replacing Firebase

This API replaces the following Firebase services:

1. **Firestore** → MongoDB Collections
   - Room data storage
   - Scene versioning

2. **Firebase Storage** → MongoDB GridFS
   - Image file storage
   - File metadata

### Code Changes Required

**Frontend files to update**:
- `excalidraw-app/data/firebase.ts` → `excalidraw-app/data/mongodb.ts`
- `excalidraw-app/data/FileManager.ts` (update file storage calls)
- `excalidraw-app/collab/Collab.tsx` (update import references)
- `.env.development` and `.env.production` (add MongoDB backend URL)

**Functions to replace**:
- `loadFromFirebase()` → `loadFromMongoDB()`
- `saveToFirebase()` → `saveToMongoDB()`
- `saveFilesToFirebase()` → `saveFilesToMongoDB()`
- `loadFilesFromFirebase()` → `loadFilesFromMongoDB()`

---

## Example Usage

### Saving Room Data (Frontend)

```typescript
// 1. Encrypt elements on client
const { ciphertext, iv } = await encryptElements(roomKey, elements);

// 2. Send to backend
const response = await fetch(`${MONGODB_BACKEND_URL}/api/rooms/${roomId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
    sceneVersion: getSceneVersion(elements)
  })
});

const result = await response.json();
```

### Loading Room Data (Frontend)

```typescript
// 1. Fetch from backend
const response = await fetch(`${MONGODB_BACKEND_URL}/api/rooms/${roomId}`);
const data = await response.json();

// 2. Decrypt on client
const elements = await decryptElements({
  iv: base64ToArrayBuffer(data.data.iv),
  ciphertext: base64ToArrayBuffer(data.data.ciphertext)
}, roomKey);
```

### Uploading File (Frontend)

```typescript
// 1. Encrypt file on client
const encryptedBuffer = await encryptFile(fileBuffer, roomKey);

// 2. Upload to backend
const response = await fetch(
  `${MONGODB_BACKEND_URL}/api/files/rooms/${roomId}/${fileId}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: encryptedBuffer
  }
);
```

---

## Testing

### Health Check Endpoint

**Endpoint**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "healthy",
  "mongodb": "connected",
  "version": "1.0.0",
  "timestamp": "2026-02-27T10:30:00.000Z"
}
```

Use this endpoint to verify backend connectivity and MongoDB status.
