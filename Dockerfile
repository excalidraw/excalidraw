FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,id=s/91e7278d-8f26-41f0-9b29-fc9c9fe7b7e2-root-cache-yarn,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

# Platforms like Railway assign the listen port via $PORT at runtime and
# route traffic to it, so nginx has to listen on it instead of a hardcoded
# port. default.conf.template is rendered with envsubst by the base image's
# docker-entrypoint.d scripts before nginx starts. Default to 80 so the
# image still works unchanged for local use (e.g. docker-compose).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80

HEALTHCHECK CMD wget -q -O /dev/null "http://localhost:${PORT}" || exit 1
