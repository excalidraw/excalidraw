FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:stable-alpine-slim@sha256:8c950211a641ec5b23f265450517001f6bcca533666120ebe36cb4cff3d00a55

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
