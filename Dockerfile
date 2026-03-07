FROM --platform=${BUILDPLATFORM} node:20 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
ARG BUILDARCH
RUN --mount=type=cache,target=/root/.cache/yarn \
    NODE_ARCH="${BUILDARCH}" && \
    if [ "${NODE_ARCH}" = "amd64" ]; then NODE_ARCH="x64"; fi && \
    npm_config_arch="${NODE_ARCH}" npm_config_target_arch="${NODE_ARCH}" yarn --network-timeout 600000

ARG NODE_ENV=production

RUN yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
