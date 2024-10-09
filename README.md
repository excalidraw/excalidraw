
<p align="center"> <a href="https://alkemio.foundation/" target="blank"><img src="https://alkemio.foundation/uploads/logos/alkemio-logo.svg" width="400" alt="Alkemio Logo" /></a>

</p>
<p align="center"><i>Enabling society to collaborate. Building a better future, together.</i></p>
# Alkemio fork of Excalidraw v0.17.0

### Upgrade procedure
```
  git fetch --tags upstream
  git checkout 0.16.1-alkemio-1
  git merge v0.17.0
  git push --set-upstream origin 0.17.0-alkemio-1
```

### List of differences with standard Excalidraw
- ZoomToFit feature exposed through the external API
- Added ZoomToFit button to the zoom toolbar
- Added ZoomToFit flag to initialData to fit items on load
- Modified the paste functionality to avoid pasting elements (such as images) as JSON when editing text.
- Added `hideLibraryButton` to the appState to be able to hide the button from outside.
- Changed the toolbar Lock button behavior. Now it locks/unlocks elements instead of the tool in use
- Changed the load from file behavior to fix multi-user collaboration bug. Now elements loaded will have version number > currentScene version number

### Testing locally inside Alkemio client
```
npm link
cd ../client-web
npm link @alkemio/excalidraw --save
```

### Build and publish the new npm package:
Find in json files any `'alkemio-XX'` and set the version you want to publish
```
yarn
cd src/packages/excalidraw
yarn install
yarn build:umd
yarn pack
yarn publish
```

## Change Log

### Alkemio fork of Excalidraw v0.17.0-alkemio-4
- Added `hideLibraryButton` to the appState to be able to hide the button from outside.
- Changed the toolbar Lock button behavior. Now it locks/unlocks elements instead of the tool in use

### Alkemio fork of Excalidraw v0.17.0-alkemio-3-beta
- Changed behavior. Pasting elements is better handled and now it doesn't end up as a big text node with JSON inside.

### Alkemio fork of Excalidraw v0.17.0
- Upgraded from Excalidraw v0.16.1 to v0.17.0
- Applied the new styles of the buttons to Alkemio's ZoomToFit added button.


### Alkemio fork of Excalidraw v0.16.1

- Upgraded from Excalidraw v0.15.2 to v0.16.1

  - Sync master branch from github
  - `git pull`
  - Sync tags:

  ```
  $ git fetch --tags upstream
  ## Assuming upstream is already pointing to the excalidraw repo, if not, just run:
  $ git remote add upstream git@github.com:excalidraw/excalidraw.git
  ```

  - Checkout a new Branch pointing to the same commit as the tag:

  ```
  $ git checkout -b branch-v0.16.1 tags/v0.16.1
  ```

  - Push the new branch to GitHub and create the PR there or merge localy if there are conflicts

- Fixed merge conflicts and a small issue with the zoomToFit icon, they have added a function with the same name.

### Alkemio fork of Excalidraw v0.15.2

#### Modifications:

- ZoomToFit feature exposed through the external API
- Added ZoomToFit button to the zoom toolbar
- Added ZoomToFit flag to initialData to fit items on load

#### Development guidelines

- First of all, Excalidraw uses yarn as package manager, so first thing to do is make sure you have yarn installed in your system. `npm install --global yarn`.
- Clone the repository to a local folder: `git clone git@github.com:alkem-io/excalidraw.git` and create a feature branch to store your work.
- Follow the original Excalidraw instructions below to run and debug with the included test application - Just `yarn ; yarn start` should work.
- To test/debug Excalidraw inside our client-web application:
  - Execute `npm link` in the root of your cloned repository.
  - Go to your client-web folder and execute: `npm link @alkemio/excalidraw --save`
- When you're done with the development commit and push everything, create a Pull Request in the alkem-io/excalidraw repository to merge your branch to develop.
- Once is merged to `develop`, checkout `develop` branch and see below how to build and publish the package to NPM repository.
- Make sure you switch back the package in your client-web to use the published @alkemio/excalidraw package's new version instead of the old one or the linked one if you changed it.

#### Build and publish a new npm package:

```
yarn
cd src/packages/excalidraw
yarn install
yarn build:umd
yarn pack
yarn publish
```

<hr />


<a href="https://excalidraw.com/" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" alt="Excalidraw" srcset="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2_dark.png" />
    <img alt="Excalidraw" src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" />
  </picture>
</a>

<h4 align="center">
  <a href="https://excalidraw.com">Excalidraw Editor</a> |
  <a href="https://blog.excalidraw.com">Blog</a> |
  <a href="https://docs.excalidraw.com">Documentation</a> |
  <a href="https://plus.excalidraw.com">Excalidraw+</a>
</h4>

<div align="center">
  <h2>
    An open source virtual hand-drawn style whiteboard. </br>
    Collaborative and end-to-end encrypted. </br>
  <br />
  </h2>
</div>

<br />
<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="Excalidraw is released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg"  />
  </a>
  <a href="https://www.npmjs.com/package/@excalidraw/excalidraw">
    <img alt="npm downloads/month" src="https://img.shields.io/npm/dm/@excalidraw/excalidraw"  />
  </a>
  <a href="https://docs.excalidraw.com/docs/introduction/contributing">
    <img alt="PRs welcome!" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat"  />
  </a>
  <a href="https://discord.gg/UexuTaE">
    <img alt="Chat on Discord" src="https://img.shields.io/discord/723672430744174682?color=738ad6&label=Chat%20on%20Discord&logo=discord&logoColor=ffffff&widge=false"/>
  </a>
  <a href="https://twitter.com/excalidraw">
    <img alt="Follow Excalidraw on Twitter" src="https://img.shields.io/twitter/follow/excalidraw.svg?label=follow+@excalidraw&style=social&logo=twitter"/>
  </a>
</p>

<div align="center">
  <figure>
    <a href="https://excalidraw.com" target="_blank" rel="noopener">
      <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github%2Fproduct_showcase.png" alt="Product showcase" />
    </a>
    <figcaption>
      <p align="center">
        Create beautiful hand-drawn like diagrams, wireframes, or whatever you like.
      </p>
    </figcaption>
  </figure>
</div>

## Features

The Excalidraw editor (npm package) supports:

- 💯&nbsp;Free & open-source.
- 🎨&nbsp;Infinite, canvas-based whiteboard.
- ✍️&nbsp;Hand-drawn like style.
- 🌓&nbsp;Dark mode.
- 🏗️&nbsp;Customizable.
- 📷&nbsp;Image support.
- 😀&nbsp;Shape libraries support.
- 👅&nbsp;Localization (i18n) support.
- 🖼️&nbsp;Export to PNG, SVG & clipboard.
- 💾&nbsp;Open format - export drawings as an `.excalidraw` json file.
- ⚒️&nbsp;Wide range of tools - rectangle, circle, diamond, arrow, line, free-draw, eraser...
- ➡️&nbsp;Arrow-binding & labeled arrows.
- 🔙&nbsp;Undo / Redo.
- 🔍&nbsp;Zoom and panning support.

## Excalidraw.com

The app hosted at [excalidraw.com](https://excalidraw.com) is a minimal showcase of what you can build with Excalidraw. Its [source code](https://github.com/excalidraw/excalidraw/tree/master/excalidraw-app) is part of this repository as well, and the app features:

- 📡&nbsp;PWA support (works offline).
- 🤼&nbsp;Real-time collaboration.
- 🔒&nbsp;End-to-end encryption.
- 💾&nbsp;Local-first support (autosaves to the browser).
- 🔗&nbsp;Shareable links (export to a readonly link you can share with others).

We'll be adding these features as drop-in plugins for the npm package in the future.

## Quick start

**Note:** following instructions are for installing the Excalidraw [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw) when integrating Excalidraw into your own app. To run the repository locally for development, please refer to our [Development Guide](https://docs.excalidraw.com/docs/introduction/development).

```
npm install react react-dom @excalidraw/excalidraw
```

or via yarn

```
yarn add react react-dom @excalidraw/excalidraw
```

Check out our [documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) for more details!

## Contributing

- Missing something or found a bug? [Report here](https://github.com/excalidraw/excalidraw/issues).
- Want to contribute? Check out our [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing) or let us know on [Discord](https://discord.gg/UexuTaE).
- Want to help with translations? See the [translation guide](https://docs.excalidraw.com/docs/introduction/contributing#translating).

## Integrations

- [VScode extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
- [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw)

## Who's integrating Excalidraw

[Google Cloud](https://googlecloudcheatsheet.withgoogle.com/architecture) • [Meta](https://meta.com/) • [CodeSandbox](https://codesandbox.io/) • [Obsidian Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) • [Replit](https://replit.com/) • [Slite](https://slite.com/) • [Notion](https://notion.so/) • [HackerRank](https://www.hackerrank.com/) • and many others

## Sponsors & support

If you like the project, you can become a sponsor at [Open Collective](https://opencollective.com/excalidraw) or use [Excalidraw+](https://plus.excalidraw.com/).

## Thank you for supporting Excalidraw

[<img src="https://opencollective.com/excalidraw/tiers/sponsors/0/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/0/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/1/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/1/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/2/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/2/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/3/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/3/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/4/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/4/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/5/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/5/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/6/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/6/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/7/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/7/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/8/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/8/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/9/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/9/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/10/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/10/website)

<a href="https://opencollective.com/excalidraw#category-CONTRIBUTE" target="_blank"><img src="https://opencollective.com/excalidraw/tiers/backers.svg?avatarHeight=32"/></a>

Last but not least, we're thankful to these companies for offering their services for free:

[![Vercel](./.github/assets/vercel.svg)](https://vercel.com) [![Sentry](./.github/assets/sentry.svg)](https://sentry.io) [![Crowdin](./.github/assets/crowdin.svg)](https://crowdin.com)
