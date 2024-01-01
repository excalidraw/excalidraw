FROM node:18 AS build

WORKDIR /opt/node_app

FROM build as production_buildstage

COPY package.json yarn.lock ./
COPY excalidraw-app/package.json ./excalidraw-app/
COPY packages/excalidraw/package.json ./packages/excalidraw/

RUN yarn --network-timeout 600000

COPY . .

ARG NODE_ENV=production
RUN yarn build:app:docker

FROM nginx:1.21-alpine as production

COPY --from=production_buildstage /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1

FROM build as development