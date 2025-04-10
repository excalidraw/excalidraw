FROM node:18

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn config set "strict-ssl" false -g
RUN yarn

WORKDIR /app/excalidraw-app
COPY excalidraw-app/package.json ./
RUN yarn

WORKDIR /app
COPY . /app
