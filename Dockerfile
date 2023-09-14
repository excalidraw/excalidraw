FROM --platform=${BUILDPLATFORM} node:18 AS build

WORKDIR /opt/node_app

COPY package.json yarn.lock ./
RUN npm_config_target_arch=${TARGETARCH} yarn --ignore-optional --network-timeout 600000

ARG NODE_ENV=production

COPY . .
RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} nginx:1.21-alpine

COPY --from=build /opt/node_app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
