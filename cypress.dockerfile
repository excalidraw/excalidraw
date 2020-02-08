FROM cypress/base:ubuntu18-node12.14.1

RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY cypress ./cypress
COPY cypress.json .

COPY package.json .
COPY package-lock.json .

ENV CI=1
RUN npm ci
RUN rm -rf ./cypress/snapshots
RUN npx cypress verify
