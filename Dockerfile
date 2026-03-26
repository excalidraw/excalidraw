FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production
ARG VITE_APP_BASE_PATH
ARG VITE_APP_WS_SERVER_PATH

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine
COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html${VITE_APP_BASE_PATH}

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
