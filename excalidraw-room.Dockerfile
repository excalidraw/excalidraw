# Reuses official excalidraw-room from GitHub
# (Docker Compose on Windows cannot build directly from git URLs)
FROM node:12-alpine

WORKDIR /excalidraw-room
RUN apk add --no-cache git && \
    git clone --depth 1 https://github.com/excalidraw/excalidraw-room.git .
RUN yarn
RUN yarn build

ENV PORT=80
EXPOSE 80
CMD ["yarn", "start"]
