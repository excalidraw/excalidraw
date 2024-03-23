FROM node:18 AS build

WORKDIR /home/node/app

COPY . .

RUN npm install
RUN cd excalidraw-app && npm run build:app:docker

FROM nginx:1.21-alpine

COPY --from=build /home/node/app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
