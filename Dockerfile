FROM --platform=${BUILDPLATFORM} oven/bun:1 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.bun/install/cache \
    npm_config_target_arch=${TARGETARCH} bun install

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} bun build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
