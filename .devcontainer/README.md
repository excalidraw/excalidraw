# Excalidraw DevContainer Setup

Complete development environment with MongoDB, API backend, and nginx routing.

## Architecture

```
nginx (port 80)
├── / → excalidraw-dev:3001 (Frontend)
├── /api → backend:3003 (API Server)
└── /mongo-express → mongo-express:8081 (DB UI)
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **nginx** | 80 | Reverse proxy and main entry point |
| **excalidraw-dev** | 3001 | Vite dev server (editable workspace) |
| **backend** | 3003 | Node.js API server with MongoDB |
| **mongodb** | 27017 | MongoDB 7.0 database |
| **mongo-express** | 8081 | Web-based MongoDB admin UI |

## Getting Started

### 1. Open in DevContainer

**VS Code:**
1. Open this project in VS Code
2. Press `F1` or `Ctrl+Shift+P`
3. Select "Dev Containers: Reopen in Container"
4. Wait for container build and initialization

**VS Code Command Palette:**
```
> Dev Containers: Reopen in Container
```

### 2. Install Dependencies

Inside the container terminal:
```bash
yarn install
```

### 3. Start Development Server

```bash
yarn start
```

The Vite dev server will start on port 3001 and nginx will proxy it to port 80.

### 4. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **Main App** | http://localhost | Excalidraw frontend via nginx |
| **Direct Dev** | http://localhost:3001 | Direct access to Vite dev server |
| **API** | http://localhost/api | Backend API endpoints |
| **Mongo Express** | http://localhost/mongo-express | MongoDB admin interface |
| **MongoDB** | mongodb://localhost:27017 | Direct database connection |

## Development Workflow

### Editing Code

Only the main Excalidraw project is mounted and editable:
- ✅ Edit files in `/workspace` (this project)
- ✅ Changes hot-reload automatically
- ❌ Backend/MongoDB run in isolated containers

### Accessing MongoDB

**Via Mongo Express UI:**
- Navigate to http://localhost/mongo-express
- Browse collections: `rooms`, `files.files`, `files.chunks`

**Via MongoDB Compass:**
- Connection string: `mongodb://localhost:27017/excalidraw`

**Via VS Code Extension:**
- Install "MongoDB for VS Code" extension (auto-installed)
- Add connection: `mongodb://localhost:27017`

### Testing API Endpoints

**Health Check:**
```bash
curl http://localhost/api/health
```

**List Rooms:**
```bash
curl http://localhost/api/rooms
```

**Get Room Data:**
```bash
curl http://localhost/api/rooms/{roomId}
```

## Container Management

### View Running Containers

```bash
docker ps
```

### View Logs

```bash
# All services
docker-compose -f .devcontainer/docker-compose.yml logs

# Specific service
docker-compose -f .devcontainer/docker-compose.yml logs backend
docker-compose -f .devcontainer/docker-compose.yml logs nginx
```

### Restart Services

```bash
# Restart backend API
docker-compose -f .devcontainer/docker-compose.yml restart backend

# Restart nginx
docker-compose -f .devcontainer/docker-compose.yml restart nginx
```

### Rebuild Containers

```bash
# Rebuild all
docker-compose -f .devcontainer/docker-compose.yml build

# Rebuild specific service
docker-compose -f .devcontainer/docker-compose.yml build backend
```

## Environment Variables

### Frontend (.env.development)
```env
VITE_APP_MONGODB_BACKEND_URL=http://localhost/api
VITE_APP_DISABLE_PREVENT_UNLOAD=true
```

### Backend (backend/.env)
```env
NODE_ENV=development
PORT=3003
MONGODB_URI=mongodb://mongodb:27017/excalidraw
CORS_ORIGINS=http://localhost,http://localhost:80,http://localhost:3001
MAX_FILE_SIZE=4194304
```

## Troubleshooting

### Port Already in Use

If port 80 is already in use:
1. Stop conflicting service
2. Or modify `.devcontainer/docker-compose.yml`:
   ```yaml
   nginx:
     ports:
       - "8080:80"  # Change to different port
   ```

### Container Build Fails

```bash
# Clean rebuild
docker-compose -f .devcontainer/docker-compose.yml down -v
docker-compose -f .devcontainer/docker-compose.yml build --no-cache
```

### MongoDB Connection Issues

Check MongoDB is running:
```bash
docker-compose -f .devcontainer/docker-compose.yml logs mongodb
```

### Backend API Not Responding

Check backend logs:
```bash
docker-compose -f .devcontainer/docker-compose.yml logs backend
```

Restart backend:
```bash
docker-compose -f .devcontainer/docker-compose.yml restart backend
```

### Hot Reload Not Working

Ensure file watching is enabled in Vite config and volumes are properly mounted.

## Data Persistence

**MongoDB Data:**
- Persisted in Docker volume: `mongodb_data`
- Survives container restarts
- Lost when using `docker-compose down -v`

**Node Modules:**
- Cached in Docker volumes for performance
- Rebuild with `yarn install` if corrupted

## VS Code Extensions

Auto-installed extensions:
- ESLint
- Prettier
- EditorConfig
- Docker
- MongoDB for VS Code

## Stopping the Environment

**Keep data:**
```bash
docker-compose -f .devcontainer/docker-compose.yml down
```

**Remove all data:**
```bash
docker-compose -f .devcontainer/docker-compose.yml down -v
```

## Production Deployment

For production, use the root `docker-compose.yml`:
```bash
docker-compose up -d
```

Configure production environment variables in `.env.production`.
