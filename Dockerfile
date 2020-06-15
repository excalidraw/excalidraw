FROM node:14-alpine AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
ENV NODE_ENV=production
RUN npm run build:app

FROM nginx:1.17-alpine

COPY --from=build /usr/src/app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
