FROM node:18 AS build

WORKDIR /opt/node_app

COPY package.json yarn.lock ./
RUN yarn --ignore-optional --network-timeout 600000

ARG NODE_ENV=production

COPY . .
RUN yarn build:app:docker

FROM nginx:1.21-alpine

# Set a default value for PORT if it's not set
# Using :80 for backward compatibility with the
# original value in /etc/nginx/conf.d/default.conf
ENV PORT=${PORT:-80}
EXPOSE ${PORT}

COPY --from=build /opt/node_app/build /usr/share/nginx/html
COPY docker-config/nginx.conf.template /etc/nginx/conf.d/nginx.conf.template
COPY docker-config/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]

HEALTHCHECK  --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:${PORT} || exit 1
