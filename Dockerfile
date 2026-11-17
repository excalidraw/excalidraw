FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

# pnpm is provided by corepack, at the version pinned by "packageManager" in
# package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
#
# the pnpm store lives in a cache mount, so packages are copied (not linked)
# into node_modules
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    npm_config_target_arch=${TARGETARCH} pnpm install --frozen-lockfile \
    --store-dir /pnpm/store --package-import-method copy \
    --config.fetch-timeout=600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} pnpm build:app:docker

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
