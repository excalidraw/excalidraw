# Build stage - full monorepo for workspace dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy everything (monorepo needs full structure for workspaces)
COPY . .

# Install dependencies with full workspace structure
RUN yarn install --frozen-lockfile --network-timeout 600000

# Build the application
RUN yarn build:app:docker

# Explicitly copy PDF files from public directory to build output
RUN mkdir -p /app/excalidraw-app/build/pdf/build && \
    cp /app/public/pdf/build/*.mjs /app/excalidraw-app/build/pdf/build/ && \
    echo "PDF files copied successfully" && \
    ls -la /app/excalidraw-app/build/pdf/build/

# Production stage - only built files and http-server
FROM node:18-alpine

WORKDIR /app

# Install http-server globally
RUN npm install -g http-server

# Copy only the built static files from builder
COPY --from=builder /app/excalidraw-app/build ./build

# Expose port (Railway provides $PORT)
EXPOSE $PORT

# Start http-server on Railway's $PORT
CMD ["sh", "-c", "http-server build -p $PORT -g"]
