# Build stage - full monorepo for workspace dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy everything (monorepo needs full structure for workspaces)
COPY . .

# Install dependencies with full workspace structure
RUN yarn install --frozen-lockfile --network-timeout 600000

# Declare build-time variables (Railway will inject these from environment variables)
ARG VITE_CANVAS_AUTH_ENABLED
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CANVAS_APP_URL
ARG VITE_APP_WS_SERVER_URL
ARG VITE_LLM_SERVICE_URL
ARG VITE_APP_API_URL
ARG VITE_DODOPAYMENTS_ENVIRONMENT

# Make them available as environment variables during build
ENV VITE_CANVAS_AUTH_ENABLED=$VITE_CANVAS_AUTH_ENABLED
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CANVAS_APP_URL=$VITE_CANVAS_APP_URL
ENV VITE_APP_WS_SERVER_URL=$VITE_APP_WS_SERVER_URL
ENV VITE_LLM_SERVICE_URL=$VITE_LLM_SERVICE_URL
ENV VITE_APP_API_URL=$VITE_APP_API_URL
ENV VITE_DODOPAYMENTS_ENVIRONMENT=$VITE_DODOPAYMENTS_ENVIRONMENT

# Build the application
RUN yarn build:app:docker

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
