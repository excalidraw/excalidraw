# Backend

Express server for the Terraform-Excalidraw integration.

## Setup

```bash
cd backend
npm install express
```

## Run

```bash
node index.js
```

### With auto-reload (nodemon)

```bash
npm install -g nodemon
nodemon index.js
```

Server starts on `http://localhost:3000`. Nodemon will automatically restart the server when you save changes to any file.

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hello` | Health check / test endpoint |
