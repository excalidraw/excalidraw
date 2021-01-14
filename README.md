<div align="center" style="display:flex;flex-direction:column;">
  <a href="https://excalidraw.com">
    <img width="540" src="./public/og-image-sm.png" alt="Excalidraw logo: Sketch handrawn like diagrams." />
  </a>
  <h3>Virtual whiteboard for sketching hand-drawn like diagrams.<br>Collaborative and end to end encrypted.</h3>
  <p>
    <a href="https://twitter.com/Excalidraw">
      <img alt="Follow Excalidraw on Twitter" src="https://img.shields.io/twitter/follow/excalidraw.svg?label=follow+excalidraw&style=social&logo=twitter">
    </a>
    <a target="_blank" href="https://crowdin.com/project/excalidraw">
      <img src="https://badges.crowdin.net/excalidraw/localized.svg">
    </a>
  </p>
</div>

## Try it now

Go to [excalidraw.com](https://excalidraw.com) to start sketching.

Read the latest news and updates on our [blog](https://blog.excalidraw.com). A good start is to see all the updates of [One Year of Excalidraw](https://blog.excalidraw.com/one-year-of-excalidraw/).

## Documentation

### Shortcuts

You can almost do anything with shortcuts. Click on the help icon on the bottom right corner to see them all.

### Curved lines and arrows

Choose line or arrow and click click click instead of drag.

### Charts

You can easily create charts by copy pasting data from Excel or just plain comma separated text.

### Translating

To translate Excalidraw into other languages, please visit [our Crowdin page](https://crowdin.com/project/excalidraw). To add a new language, [open an issue](https://github.com/excalidraw/excalidraw/issues/new) so we can get things set up on our end first.

Translations will be available on the app if they exceed a certain threshold of completion (currently 85%).

### Create a collaboration session manually

In order to create a session manually you just need to generate a link of this form:

```
https://excalidraw.com/#room=[0-9a-f]{20},[a-zA-Z0-9_-]{22}
```

#### Example

```
https://excalidraw.com/#room=91bd46ae3aa84dff9d20,pfLqgEoY1c2ioq8LmGwsFA
```

The first set of digits is the room. This is visible from the server that’s going to dispatch messages to everyone that knows this number.

The second set of digits is the encryption key. The Excalidraw server doesn’t know about it. This is what all the participants use to encrypt/decrypt the messages.

## Shape libraries

Find a growing list of libraries containing assets for your drawings at [libraries.excalidraw.com](https://libraries.excalidraw.com).

## Developement

### Code Sandbox

- Go to https://codesandbox.io/s/github/excalidraw/excalidraw
  - You may need to sign in with Github and reload the page
- You can start coding instantly, and even send PRs from there!

### Local Installation

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

#### Clone the repo

```bash
git clone https://github.com/excalidraw/excalidraw.git
```

#### Commands

| Command               | Description                       |
| --------------------- | --------------------------------- |
| `npm install`         | Install the dependencies          |
| `npm start`           | Run the project                   |
| `npm run fix`         | Reformat all files with Prettier  |
| `npm test`            | Run tests                         |
| `npm run test:update` | Update test snapshots             |
| `npm run test:code`   | Test for formatting with Prettier |

#### Docker Compose

You can use docker-compose to work on excalidraw locally if you don't want to setup a Node.js env.

```sh
docker-compose up --build -d
```

### Self hosting

We publish a Docker image with the Excalidraw client at [excalidraw/excalidraw](https://hub.docker.com/r/excalidraw/excalidraw). You can use it to self host your own client under your own domain, on Kubernetes, AWS ECS, etc.

```sh
docker build -t excalidraw/excalidraw .
docker run --rm -dit --name excalidraw -p 5000:80 excalidraw/excalidraw:latest
```

The Docker image is free of analytics and other tracking libraries.

**At the moment, self-hosting your own instance doesn't support sharing or collaboration features.**

We are working towards providing a full-fledged solution for self hosting your own Excalidraw.

## Contributing

Pull requests are welcome. For major changes, please [open an issue](https://github.com/excalidraw/excalidraw/issues/new) first to discuss what you would like to change.

## Notable used tools

- [Create React App](https://github.com/facebook/create-react-app)
- [Rough.js](https://roughjs.com)
- [TypeScript](https://www.typescriptlang.org)
- [Vercel](https://vercel.com)

And the main source of inspiration for starting the project is the awesome [Zwibbler](https://zwibbler.com/demo/) app.
