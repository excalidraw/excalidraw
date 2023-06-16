# Excalidraw

**Excalidraw** is exported as a component to directly embed in your projects.

## Installation

You can use `npm`

```bash
npm install react react-dom @excalidraw/excalidraw
```

or via `yarn`

```bash
yarn add react react-dom @excalidraw/excalidraw
```

After installation you will see a folder `excalidraw-assets` and `excalidraw-assets-dev` in `dist` directory which contains the assets needed for this app in prod and dev mode respectively.

Move the folder `excalidraw-assets` and `excalidraw-assets-dev` to the path where your assets are served.

By default it will try to load the files from [`https://unpkg.com/@excalidraw/excalidraw/dist/`](https://unpkg.com/@excalidraw/excalidraw/dist)

If you want to load assets from a different path you can set a variable `window.EXCALIDRAW_ASSET_PATH` depending on environment (for example if you have different URL's for dev and prod) to the url from where you want to load the assets.

#### Note

**If you don't want to wait for the next stable release and try out the unreleased changes you can use `@excalidraw/excalidraw@next`.**

## Dimensions of Excalidraw

Excalidraw takes _100%_ of `width` and `height` of the containing block so make sure the container in which you render Excalidraw has non zero dimensions.

### Demo

[Try here](https://codesandbox.io/s/excalidraw-ehlz3).

## Integration

Head over to the [docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration)

## API

Head over to the [docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api)

## Contributing

Head over to the [docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/contributing)
