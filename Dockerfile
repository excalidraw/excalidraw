FROM node:18 AS build

WORKDIR /opt/node_app

COPY package.json yarn.lock ./
RUN yarn

ARG NODE_ENV=production

COPY . .

WORKDIR /opt/node_app/excalidraw-app
RUN yarn
ARG NODE_ENV=production
RUN yarn build:app:docker

FROM nginx:1.21-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
