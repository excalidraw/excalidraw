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

FROM nginxinc/nginx-unprivileged:1.25-alpine-slim as production

COPY nginx.conf /etc/nginx/conf.d/configfile.template
COPY --from=production_buildstage /opt/node_app/excalidraw-app/build /usr/share/nginx/html

ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080

# Substitute $PORT variable in config file with the one passed via "docker run"
CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/configfile.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

# HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1

# FROM build as development