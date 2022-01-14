# Switchboard Demo using [Excalidraw](https://github.com/excalidraw/excalidraw)

### Local Installation

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

#### Requirements

- [Node.js](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/getting-started/install) (v1 or v2.4.2+)
- [Git](https://git-scm.com/downloads)

#### Clone the repo

```bash
git clone https://github.com/excalidraw/excalidraw.git
```

#### SSH access

Make sure you can ssh to and from switchboard https://docs.github.com/en/authentication/connecting-to-github-with-ssh/about-ssh

#### Install the dependencies

```bash
yarn
yarn build-switchboard
```

#### Start the switchboard server

Go to the switchboard repo make sure to be on the `carlos-excalidraw-prototype` branch and follow the readme to the server

#### Start the excalidraw server

```bash
yarn start
```

Important: Now you can open [http://0.0.0.0:3000](http://0.0.0.0:3000) (NOT localhost:3000)

#### How to reset state after finishing a tour

Use postman collection to reset state (ping carlos if you don't have it)

#### How to pull recent changes from switchboard

```bash
yarn upgrade-switchboard
```

#### Commands

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `yarn`             | Install the dependencies          |
| `yarn start`       | Run the project                   |
| `yarn fix`         | Reformat all files with Prettier  |
| `yarn test`        | Run tests                         |
| `yarn test:update` | Update test snapshots             |
| `yarn test:code`   | Test for formatting with Prettier |

#### Docker Compose

You can use docker-compose to work on Excalidraw locally if you don't want to setup a Node.js env.

```sh
docker-compose up --build -d
```
