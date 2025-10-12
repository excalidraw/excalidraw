# Build stage - full monorepo for workspace dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy everything (monorepo needs full structure for workspaces)
COPY . .

# Install dependencies with full workspace structure
RUN yarn install --frozen-lockfile --network-timeout 600000

# Build the application
RUN yarn build:app:docker

# Debug: List build output to verify PDF files are included
RUN echo "=== Build output contents ===" && \
    find /app/excalidraw-app/build -name "*.mjs" -type f && \
    echo "=== PDF directory contents ===" && \
    ls -la /app/excalidraw-app/build/pdf/ || echo "PDF directory not found" && \
    echo "=== Full build directory structure ===" && \
    find /app/excalidraw-app/build -type d | head -20 && \
    echo "=== Public directory check ===" && \
    ls -la /app/public/pdf/ || echo "Public PDF directory not found"

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
