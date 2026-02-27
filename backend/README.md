# Excalidraw Backend API

MongoDB backend API server for Excalidraw room persistence and collaboration.

## Features

- Room data persistence with encryption support
- File storage using MongoDB GridFS
- Room metadata management
- RESTful API with JSON responses
- CORS enabled for frontend integration

## Prerequisites

- Node.js 18+
- MongoDB 7.0+

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Running

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

See [API_CONTRACT.md](../API_CONTRACT.md) for complete API documentation.

### Room Endpoints
- `GET /api/rooms/:roomId` - Get room data
- `POST /api/rooms/:roomId` - Save/update room data
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/:roomId/metadata` - Get room metadata
- `PUT /api/rooms/:roomId/metadata` - Update room metadata

### File Endpoints
- `POST /api/files/:prefix/:fileId` - Upload file
- `GET /api/files/:prefix/:fileId` - Download file
- `POST /api/files/metadata` - Get multiple files metadata

### Health Check
- `GET /health` - Service health status

## Docker

Build:
```bash
docker build -t excalidraw-backend .
```

Run:
```bash
docker run -p 3003:3003 -e MONGODB_URI=mongodb://mongodb:27017/excalidraw excalidraw-backend
```
