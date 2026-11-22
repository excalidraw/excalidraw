FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

# Run unprivileged: non-root user on port 8080, only /tmp needs to be writable.
# Supports: --read-only --tmpfs /tmp --cap-drop=ALL --security-opt no-new-privileges
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

# 101 is the uid/gid of the `nginx` user shipped with the base image
USER 101:101

EXPOSE 8080

HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1:8080 || exit 1
