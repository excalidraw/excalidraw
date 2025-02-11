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

After installation you will see a folder `excalidraw-assets` in `node_modules/@excalidraw/excalidraw/dist/browser/prod` directory which contains the necessary assets, including fonts and translation files.

By default, excalidraw will try to load the files from [`https://unpkg.com/@excalidraw/excalidraw/dist/prod/`](https://unpkg.com/@excalidraw/excalidraw/dist)

For self-hosting purposes, copy the content of the folder `excalidraw-assets` to the path where your assets should be server from (i.e. `public/` directory in your project). In that case, you should also set `window.EXCALIDRAW_ASSET_PATH` to the very same path, i.e. `/` in case it's in the root:

```js
<script>
    window.EXCALIDRAW_ASSET_PATH = "/";
</script>
```

or 

```js
<script>
    window.EXCALIDRAW_ASSET_PATH = window.origin;
</script>
```

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
