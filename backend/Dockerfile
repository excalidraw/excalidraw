FROM --platform=${BUILDPLATFORM} node:24-alpine AS build
WORKDIR /opt/node_app
RUN apk add --no-cache openssl
COPY . .
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000
RUN yarn workspace backend prisma:generate
RUN yarn workspace backend build

FROM node:24-alpine
WORKDIR /opt/node_app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /opt/node_app/node_modules ./node_modules
COPY --from=build /opt/node_app/backend/node_modules ./backend/node_modules
COPY --from=build /opt/node_app/backend/dist ./backend/dist
COPY --from=build /opt/node_app/backend/prisma ./backend/prisma
COPY --from=build /opt/node_app/backend/package.json ./backend/package.json
WORKDIR /opt/node_app/backend
EXPOSE 3010
HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3010/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
