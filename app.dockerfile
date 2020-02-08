FROM node:12.15.0

RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
ENV CI=1
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
WORKDIR /usr/src/app/build
CMD ["npx", "http-server", "-c-1", "-p3000", "-s"]