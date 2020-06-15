FROM node:14-alpine AS build

ARG NODE_ENV=production
ARG REACT_APP_INCLUDE_GTAG=false
ENV NODE_ENV $NODE_ENV

RUN mkdir /opt/node_app && chown node:node /opt/node_app
WORKDIR /opt/node_app

USER node

COPY package.json package-lock.json ./
RUN npm install --no-optional && npm cache clean --force
ENV PATH /opt/node_app/node_modules/.bin:$PATH

WORKDIR /opt/node_app/app
COPY . .

CMD [ "npm", "run", "build:app" ]

FROM nginx:1.17-alpine

COPY --from=build /usr/src/app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
