# 🎯 Excalidraw DevContainer - Complete Setup

## ✅ What Has Been Created

### DevContainer Configuration (`.devcontainer/`)
- **devcontainer.json** - VS Code DevContainer configuration with extensions
- **docker-compose.yml** - Multi-service orchestration
- **Dockerfile** - Development container image (Node 20)
- **nginx.conf** - Reverse proxy routing configuration
- **README.md** - Comprehensive DevContainer documentation

### Backend API Server (`backend/`)
- **server.js** - Complete Express.js API with 8 endpoints per API_CONTRACT.md
- **package.json** - Node.js dependencies (express, mongodb, cors, dotenv)
- **Dockerfile** - Production-ready backend image
- **.env** - Development environment (safe defaults, committed)
- **.env.example** - Template for production configuration
- **.dockerignore** - Build optimization
- **.gitignore** - Excludes node_modules, logs, production secrets
- **README.md** - Backend API documentation

### Documentation
- **DEVCONTAINER_SETUP.md** - Quick start guide with troubleshooting
- **API_CONTRACT.md** - Already exists, complete backend specification

### Configuration Updates
- **.env.development** - Updated `VITE_APP_MONGODB_BACKEND_URL=http://localhost/api`
- **.gitignore** - Added backend exclusions (node_modules, logs, production env)

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    nginx (port 80)                        │
│                   Reverse Proxy                           │
├──────────────────────────────────────────────────────────┤
│  Routes:                                                  │
│    /              → excalidraw-dev:3001 (Frontend)       │
│    /api/*         → backend:3003 (REST API)              │
│    /mongo-express → mongo-express:8081 (DB Admin)        │
└──────────────────────────────────────────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
  │ excalidraw- │  │   backend   │  │    mongo-    │
  │     dev     │  │  (Node.js)  │  │   express    │
  │ (Editable)  │  │   Express   │  │   (DB UI)    │
  └─────────────┘  └─────────────┘  └──────────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   MongoDB 7.0   │
                  │  + GridFS       │
                  └─────────────────┘
```

## 🚀 How to Use

### Step 1: Open in DevContainer

**In VS Code:**
1. Press `F1`
2. Type: "Dev Containers: Reopen in Container"
3. Wait 2-5 minutes for first build

**What happens:**
- Docker builds 5 containers
- MongoDB starts with health checks
- Backend API connects to MongoDB
- Nginx routes everything to port 80
- VS Code attaches to `excalidraw-dev` container

### Step 2: Install Dependencies

Inside the DevContainer terminal:
```bash
yarn install
```

### Step 3: Start Development

```bash
yarn start
```

Vite dev server starts on port 3001, proxied by nginx to port 80.

### Step 4: Access Services

| What | URL | Purpose |
|------|-----|---------|
| **Main App** | http://localhost | Production-like access |
| **Direct Dev** | http://localhost:3001 | Direct Vite server |
| **Backend API** | http://localhost/api | REST endpoints |
| **Mongo Express** | http://localhost/mongo-express | Browse database |
| **Health Check** | http://localhost/api/health | Backend status |

## 🧪 Testing the Stack

### 1. Backend Health
```bash
curl http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. Create a Room
1. Visit http://localhost
2. Click "Live Collaboration"
3. Share link (creates room in MongoDB)
4. Draw something

### 3. Verify in Database
1. Open http://localhost/mongo-express
2. Database: `excalidraw`
3. Collection: `rooms`
4. See your room with encrypted data

### 4. Test All API Endpoints

```bash
# List all rooms
curl http://localhost/api/rooms

# Get room metadata (replace {roomId})
curl http://localhost/api/rooms/{roomId}/metadata

# Update room name
curl -X PUT http://localhost/api/rooms/{roomId}/metadata \
  -H "Content-Type: application/json" \
  -d '{"displayName":"My Cool Room"}'
```

## 🔧 Backend API Endpoints

All 8 endpoints from API_CONTRACT.md are implemented:

### Room Data
1. `GET /api/rooms/:roomId` - Get encrypted room data
2. `POST /api/rooms/:roomId` - Save/update room data
3. `GET /api/rooms` - List all rooms (paginated, sortable)
4. `GET /api/rooms/:roomId/metadata` - Get room metadata only
5. `PUT /api/rooms/:roomId/metadata` - Update room display name

### File Storage (GridFS)
6. `POST /api/files/:prefix/:fileId` - Upload file (images)
7. `GET /api/files/:prefix/:fileId` - Download file
8. `POST /api/files/metadata` - Check multiple files exist

### Health
- `GET /health` - Service health check

## 📦 What's Editable

### ✅ Editable (Mounted)
- All files in the root workspace
- Hot-reload works automatically
- Git available in container

### ❌ Read-Only (Separate Containers)
- Backend code runs in isolated container
- MongoDB data in Docker volume
- Nginx config (restart container to apply changes)

**To edit backend code:**
Edit `backend/server.js` on host → Restart backend container:
```bash
docker-compose -f .devcontainer/docker-compose.yml restart backend
```

## 🛠️ Development Workflow

### Typical Development Session

```bash
# 1. Open in DevContainer (VS Code: F1 → Reopen in Container)

# 2. Install dependencies
yarn install

# 3. Start dev server
yarn start

# 4. Make changes to code (auto hot-reload)

# 5. Test in browser
# - http://localhost (production-like)
# - http://localhost:3001 (direct Vite)

# 6. Check MongoDB
# - http://localhost/mongo-express

# 7. Test API
curl http://localhost/api/rooms

# 8. View logs
docker-compose -f .devcontainer/docker-compose.yml logs -f backend
```

### Modifying Backend

```bash
# Edit backend/server.js

# Restart backend
docker-compose -f .devcontainer/docker-compose.yml restart backend

# View logs
docker-compose -f .devcontainer/docker-compose.yml logs backend
```

### Checking Database

**Mongo Express UI:**
http://localhost/mongo-express

**MongoDB Compass:**
Connection: `mongodb://localhost:27017/excalidraw`

**VS Code Extension:**
(Auto-installed) Connect to `mongodb://localhost:27017`

## 🐛 Troubleshooting

### Port 80 Conflict

**Symptoms:**
```
Error: bind: address already in use
```

**Solutions:**

**Windows (IIS):**
```powershell
# Check what's using port 80
netstat -ano | findstr :80

# Stop IIS
iisreset /stop

# Or use different port
# Edit .devcontainer/docker-compose.yml
# Change nginx ports: "8080:80"
```

**Linux/Mac:**
```bash
sudo lsof -i :80
sudo systemctl stop apache2  # or nginx
```

### Container Build Fails

```bash
# Full clean rebuild
docker-compose -f .devcontainer/docker-compose.yml down -v
docker system prune -a
# Then reopen in DevContainer
```

### Backend Not Starting

```bash
# Check logs
docker-compose -f .devcontainer/docker-compose.yml logs backend

# Common issues:
# - MongoDB not ready: wait 30s and check logs
# - Port 3003 in use: change PORT in backend/.env
# - Missing dependencies: rebuild backend container
```

### MongoDB Connection Refused

```bash
# Check MongoDB health
docker-compose -f .devcontainer/docker-compose.yml ps
docker-compose -f .devcompcontainer/docker-compose.yml logs mongodb

# Restart MongoDB
docker-compose -f .devcontainer/docker-compose.yml restart mongodb
```

### Hot Reload Not Working

```bash
# Restart dev server
# In VS Code terminal: Ctrl+C then yarn start

# Or restart entire devcontainer
# F1 → "Dev Containers: Rebuild Container"
```

## 📊 Service Dependencies

```
nginx
  ├── depends_on: excalidraw-dev, backend, mongo-express
  │
excalidraw-dev
  ├── depends_on: mongodb, backend
  │
backend
  ├── depends_on: mongodb (health check)
  │
mongo-express
  ├── depends_on: mongodb (health check)
  │
mongodb
  └── (no dependencies)
```

**Startup Order:**
1. MongoDB starts first
2. Backend waits for MongoDB health
3. Mongo Express waits for MongoDB health
4. Excalidraw dev waits for MongoDB + backend
5. Nginx waits for all services

## 🔒 Security Notes

### Development Environment
- Default .env has NO secrets (safe to commit)
- MongoDB has NO authentication (localhost only)
- CORS allows localhost origins only
- All default ports and configs

### Production Deployment
- Create `backend/.env.production` from `.env.example`
- Enable MongoDB authentication
- Configure proper CORS origins
- Use environment secrets management
- Enable HTTPS/TLS
- Deploy behind WAF (as planned)

## 📁 File Structure

```
excalidraw/
├── .devcontainer/
│   ├── devcontainer.json      ← VS Code config
│   ├── docker-compose.yml     ← Service orchestration
│   ├── Dockerfile             ← Dev container image
│   ├── nginx.conf             ← Routing config
│   └── README.md              ← Detailed docs
├── backend/
│   ├── server.js              ← Express API (8 endpoints)
│   ├── package.json           ← Dependencies
│   ├── Dockerfile             ← Backend image
│   ├── .env                   ← Dev config (safe)
│   ├── .env.example           ← Production template
│   └── README.md              ← API docs
├── DEVCONTAINER_SETUP.md      ← This file
├── API_CONTRACT.md            ← Backend API specification
├── .env.development           ← Frontend dev config
└── docker-compose.yml         ← Production compose (alternative)
```

## 🎯 Next Steps

### Development
1. ✅ DevContainer configured
2. ✅ Backend API implemented
3. ✅ MongoDB connected
4. ✅ Nginx routing setup
5. 🎨 Start developing features!

### Testing
- Open http://localhost
- Create rooms and collaborate
- Edit room names
- Browse room list in menu
- Verify data in Mongo Express

### Customization
- Modify `backend/server.js` for API changes
- Update `.devcontainer/nginx.conf` for routing
- Add services to `.devcontainer/docker-compose.yml`
- Configure `backend/.env` for settings

## 💡 Pro Tips

1. **MongoDB GUI**: Use MongoDB Compass for advanced queries
2. **API Testing**: Postman/Insomnia collection at http://localhost/api
3. **Logs**: `docker-compose logs -f` in separate terminal
4. **Clean State**: `docker-compose down -v` removes all data
5. **Performance**: Close unused Docker containers
6. **VS Code**: Install Docker extension for container management

## 📚 Documentation Links

- [DevContainer Details](.devcontainer/README.md)
- [Backend API](backend/README.md)
- [API Contract](API_CONTRACT.md)
- [Original Excalidraw](README.md)

---

## ✨ What You Can Do Now

### Frontend Development
- Edit any file in the workspace
- Changes hot-reload instantly
- Full TypeScript/React dev experience
- All Excalidraw features available

### Backend Development
- API ready for integration
- 8 RESTful endpoints working
- MongoDB persistence active
- GridFS file storage ready

### Testing & Debugging
- Access all services via single port (80)
- Inspect database with Mongo Express
- View backend logs in real-time
- Test API with curl/Postman

### Deployment Ready
- Production Dockerfile included
- Environment variables templated
- CORS configurable
- Health checks implemented

---

**🎉 Your development environment is ready! Start coding!**

**Quick Start:**
```bash
# In VS Code
F1 → "Dev Containers: Reopen in Container"

# Wait for build...

# Then:
yarn install
yarn start

# Open: http://localhost
```
