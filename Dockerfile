# enable BuildKit features (mounts, platform args)
# syntax=docker/dockerfile:1.4

ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETARCH
FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

COPY . .

# Ensure optional, platform-specific native rollup packages are installed for the
# target platform (example package: @rollup/rollup-linux-x64-gnu).
# npm/yarn consult npm_config_platform and npm_config_arch when resolving
# optionalDependencies during install.
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_platform=linux npm_config_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production

# Build with the same platform/arch override so any native modules used at
# build-time match the target architecture.
RUN npm_config_platform=linux npm_config_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
