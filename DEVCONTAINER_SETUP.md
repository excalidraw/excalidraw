# Excalidraw DevContainer - Quick Start Guide

## 🚀 Getting Started

This project includes a complete DevContainer setup with MongoDB, backend API, and nginx routing.

### Option 1: DevContainer (Recommended for Development)

**Prerequisites:**
- Docker Desktop installed and running
- VS Code with "Dev Containers" extension

**Steps:**
1. Open this project in VS Code
2. Press `F1` and select "Dev Containers: Reopen in Container"
3. Wait for container build (~2-5 minutes first time)
4. Run `yarn install` in the integrated terminal
5. Run `yarn start` to start the dev server
6. Access the app at http://localhost

**What you get:**
- ✅ MongoDB database (port 27017)
- ✅ Backend API server (port 3003)
- ✅ Mongo Express UI (http://localhost/mongo-express)
- ✅ Nginx routing everything to port 80
- ✅ Hot reload for code changes
- ✅ All dependencies pre-configured

Full documentation: [.devcontainer/README.md](.devcontainer/README.md)

### Option 2: Docker Compose (Production-like)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3003
- Mongo Express: http://localhost:8081

### Option 3: Local Development

**Prerequisites:**
- Node.js 20+
- Yarn
- MongoDB 7.0+ running locally

**Steps:**
```bash
# Install dependencies
yarn install

# Start dev server
yarn start

# In another terminal, start backend
cd backend
npm install
npm start
```

## 📦 Architecture

```
┌─────────────────────────────────────────────┐
│              nginx (port 80)                │
├─────────────────────────────────────────────┤
│                                             │
│  /              → Excalidraw (port 3001)   │
│  /api/*         → Backend API (port 3003)  │
│  /mongo-express → Mongo Express (8081)     │
│                                             │
└─────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   excalidraw-dev   backend      mongo-express
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
                   MongoDB 7.0
```

## 🛠️ Available Services

| Service | Port | Access | Description |
|---------|------|--------|-------------|
| **Nginx** | 80 | http://localhost | Main entry point |
| **Excalidraw** | 3001 | http://localhost:3001 | Vite dev server |
| **Backend API** | 3003 | http://localhost/api | MongoDB REST API |
| **Mongo Express** | 8081 | http://localhost/mongo-express | DB admin UI |
| **MongoDB** | 27017 | mongodb://localhost:27017 | Database |

## 🧪 Testing the Setup

### 1. Create a Room
1. Open http://localhost
2. Click "Live Collaboration" 
3. Create a room (URL: `/#room={id},{key}`)
4. Draw something

### 2. Verify Data in MongoDB
1. Open http://localhost/mongo-express
2. Select `excalidraw` database
3. Check `rooms` collection - your room should be there
4. Note the `displayName` and encrypted `ciphertext`

### 3. Test Room Name Editing
1. In the room, look for the room name display
2. Click the pencil icon to edit
3. Change the name
4. Verify in Mongo Express that `displayName` updated

### 4. Test Room List
1. Open the hamburger menu (☰)
2. Look for the room list
3. Your room should appear in "Recent"
4. Star it to add to "Favorites"

### 5. Test API Directly

```bash
# Health check
curl http://localhost/api/health

# List all rooms
curl http://localhost/api/rooms

# Get specific room metadata
curl http://localhost/api/rooms/{roomId}/metadata
```

## 📚 Documentation

- **DevContainer Setup**: [.devcontainer/README.md](.devcontainer/README.md)
- **API Documentation**: [API_CONTRACT.md](API_CONTRACT.md)
- **Backend Server**: [backend/README.md](backend/README.md)
- **Original README**: [README.md](README.md)

## 🐛 Troubleshooting

### Port 80 Already in Use

**Windows:**
```powershell
# Check what's using port 80
netstat -ano | findstr :80

# Stop IIS if running
iisreset /stop
```

**Linux/Mac:**
```bash
# Check what's using port 80
lsof -i :80

# Use different port - edit .devcontainer/docker-compose.yml
# Change nginx ports to "8080:80"
```

### Container Build Fails

```bash
# Clean rebuild
docker-compose -f .devcontainer/docker-compose.yml down -v
docker-compose -f .devcontainer/docker-compose.yml build --no-cache
```

### MongoDB Connection Refused

```bash
# Check MongoDB status
docker-compose -f .devcontainer/docker-compose.yml logs mongodb

# Restart MongoDB
docker-compose -f .devcontainer/docker-compose.yml restart mongodb
```

### Backend Not Responding

```bash
# Check backend logs
docker-compose -f .devcontainer/docker-compose.yml logs backend

# Restart backend
docker-compose -f .devcontainer/docker-compose.yml restart backend
```

## 🎯 What's Different from Original Excalidraw?

### ✨ New Features

1. **MongoDB Persistence**
   - Rooms stored in MongoDB instead of Firebase
   - GridFS for file/image storage
   - Better control over data

2. **Custom Room Names**
   - Human-readable room names (stored separately from URLs)
   - Room list/browser in main menu
   - Favorites and recent rooms

3. **Public Room Discovery**
   - Browse all available rooms
   - Search and filter rooms
   - See active rooms (used in last hour)

4. **Complete Backend API**
   - 8 RESTful endpoints
   - Room CRUD operations
   - File upload/download
   - Metadata management

### 🔒 Security Unchanged

- Client-side encryption still active (AES-256)
- Room keys still in URL fragment
- Display names are public, content is encrypted
- No authentication (designed for WAF deployment)

## 🚢 Deployment

### Production with Docker

```bash
# Build images
docker-compose build

# Start in production mode
docker-compose up -d

# Check status
docker-compose ps
```

### Environment Variables

**Frontend (.env.production):**
```env
VITE_APP_MONGODB_BACKEND_URL=https://api.yourdomain.com
```

**Backend (backend/.env):**
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-mongo-host:27017/excalidraw
CORS_ORIGINS=https://yourdomain.com
```

## 📋 Development Workflow

1. **Start DevContainer** - Opens in VS Code with all services running
2. **Make Changes** - Edit code in `/workspace`
3. **Auto Reload** - Vite hot-reloads changes automatically
4. **Test** - Use http://localhost to test
5. **Verify Data** - Check MongoDB in Mongo Express
6. **Commit** - Git available in container

## 🎨 Customization

### Change Ports

Edit `.devcontainer/docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Change to your preferred port
```

### Add More Services

Add to `.devcontainer/docker-compose.yml`:
```yaml
redis:
  image: redis:alpine
  networks:
    - excalidraw-network
```

### Modify Nginx Routing

Edit `.devcontainer/nginx.conf`:
```nginx
location /custom {
    proxy_pass http://your-service:port;
}
```

## 💡 Tips

- **MongoDB GUI**: Use MongoDB Compass with `mongodb://localhost:27017`
- **API Testing**: Use Postman or curl against http://localhost/api
- **Logs**: Watch with `docker-compose logs -f backend`
- **Clean Start**: `docker-compose down -v && docker-compose up --build`

## 📞 Support

- Report issues on GitHub
- Check `.devcontainer/README.md` for detailed docs
- Review `API_CONTRACT.md` for API reference

---

**Ready to develop? Open in DevContainer and start coding! 🎉**
