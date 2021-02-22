### Excalidraw

Excalidraw exported as a component to directly embed in your projects

### Installation

You can use npm

```
npm install react react-dom @excalidraw/excalidraw
```

or via yarn

```
yarn add react react-dom @excalidraw/excalidraw
```

After installation you will see a folder `excalidraw-assets` in `dist` directory which contains the assets needed for this app.

Move the folder `excalidraw-assets` to the path where your assets are served.

By default it will try to load the files from `https://unpkg.com/@excalidraw/excalidraw/{currentVersion}/dist/`

If you want to load assets from a different path you can set a variable `window.EXCALIDRAW_ASSET_PATH` to the url from where you want to load the assets.

### Demo

[Try here](https://codesandbox.io/s/excalidraw-ehlz3).

### Usage

1. If you are using a Web bundler (for instance, Webpack), you can import it as an ES6 module as shown below

```js
import React, { useEffect, useState, useRef } from "react";
import Excalidraw from "@excalidraw/excalidraw";
import InitialData from "./initialData";

import "./styles.scss";

export default function App() {
  const excalidrawRef = useRef(null);
  const excalidrawWrapperRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: undefined,
    height: undefined,
  });

  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);

  useEffect(() => {
    setDimensions({
      width: excalidrawWrapperRef.current.getBoundingClientRect().width,
      height: excalidrawWrapperRef.current.getBoundingClientRect().height,
    });
    const onResize = () => {
      setDimensions({
        width: excalidrawWrapperRef.current.getBoundingClientRect().width,
        height: excalidrawWrapperRef.current.getBoundingClientRect().height,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [excalidrawWrapperRef]);

  const updateScene = () => {
    const sceneData = {
      elements: [
        {
          type: "rectangle",
          version: 141,
          versionNonce: 361174001,
          isDeleted: false,
          id: "oDVXy8D6rom3H1-LLH2-f",
          fillStyle: "hachure",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          angle: 0,
          x: 100.50390625,
          y: 93.67578125,
          strokeColor: "#c92a2a",
          backgroundColor: "transparent",
          width: 186.47265625,
          height: 141.9765625,
          seed: 1968410350,
          groupIds: [],
        },
      ],
      appState: {
        viewBackgroundColor: "#edf2ff",
      },
    };
    excalidrawRef.current.updateScene(sceneData);
  };

  return (
    <div className="App">
      <h1> Excalidraw Example</h1>
      <div className="button-wrapper">
        <button className="update-scene" onClick={updateScene}>
          Update Scene
        </button>
        <button
          className="reset-scene"
          onClick={() => {
            excalidrawRef.current.resetScene();
          }}
        >
          Reset Scene
        </button>
        <label>
          <input
            type="checkbox"
            checked={viewModeEnabled}
            onChange={() => setViewModeEnabled(!viewModeEnabled)}
          />
          View mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={zenModeEnabled}
            onChange={() => setZenModeEnabled(!zenModeEnabled)}
          />
          Zen mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={gridModeEnabled}
            onChange={() => setGridModeEnabled(!gridModeEnabled)}
          />
          Grid mode
        </label>
      </div>
      <div className="excalidraw-wrapper" ref={excalidrawWrapperRef}>
        <Excalidraw
          ref={excalidrawRef}
          width={dimensions.width}
          height={dimensions.height}
          initialData={InitialData}
          onChange={(elements, state) =>
            console.log("Elements :", elements, "State : ", state)
          }
          onPointerUpdate={(payload) => console.log(payload)}
          onCollabButtonClick={() =>
            window.alert("You clicked on collab button")
          }
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
          gridModeEnabled={gridModeEnabled}
        />
      </div>
    </div>
  );
}
```

[![Edit excalidraw](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/excalidraw-ehlz3?fontsize=14&hidenavigation=1&theme=dark)

2. To use it in a browser directly:

You will need to make sure `react`, `react-dom` is available as shown below.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Excalidraw in browser</title>
    <meta charset="UTF-8" />
    <script src="https://unpkg.com/react@16.14.0/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@16.13.1/umd/react-dom.development.js"></script>
    <script
      type="text/javascript"
      src="https://unpkg.com/@excalidraw/excalidraw@0.2.2/dist/excalidraw.min.js"
    ></script>
  </head>

  <body>
    <div class="container">
      <h4>Excalidraw Embed Example</h4>
      <div id="app"></div>
    </div>

    <script type="text/javascript" src="src/index.js"></script>
  </body>
</html>
```

```js
import "./styles.css";

const excalidrawWrapper = document.getElementById("app");

const props = {
  onChange: (data, appState) => {
    console.log(data, appState);
  },
};

/*eslint-disable */
ReactDOM.render(
  React.createElement(Excalidraw.default, props),
  excalidrawWrapper,
);
```

[![Edit excalidraw-in-browser](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/excalidraw-in-browser-tlqom?fontsize=14&hidenavigation=1&theme=dark)

Since Excalidraw doesn't support server side rendering yet so you will have to make sure the component is rendered once host is mounted.

```js
import { useState, useEffect } from "react";
export default function IndexPage() {
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    import("@excalidraw/excalidraw").then((comp) => setComp(comp.default));
  });
  return <>{Comp && <Comp />}</>;
}
```

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [`width`](#width) | Number | `window.innerWidth` | The width of Excalidraw component |
| [`height`](#height) | Number | `window.innerHeight` | The height of Excalidraw component |
| [`offsetLeft`](#offsetLeft) | Number | `0` | left position relative to which Excalidraw should be rendered |
| [`offsetTop`](#offsetTop) | Number | `0` | top position relative to which Excalidraw should render |
| [`onChange`](#onChange) | Function |  | This callback is triggered whenever the component updates due to any change. This callback will receive the excalidraw elements and the current app state. |
| [`initialData`](#initialData) | <pre>{elements?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>, appState?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37">AppState<a> } </pre> | null | The initial data with which app loads. |
| [`excalidrawRef`](#excalidrawRef) | [`createRef`](https://reactjs.org/docs/refs-and-the-dom.html#creating-refs) or [`callbackRef`](https://reactjs.org/docs/refs-and-the-dom.html#callback-refs) or <pre>{ current: { readyPromise: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317">resolvablePromise</a> } }</pre> |  | Ref to be passed to Excalidraw |
| [`onCollabButtonClick`](#onCollabButtonClick) | Function |  | Callback to be triggered when the collab button is clicked |
| [`isCollaborating`](#isCollaborating) | `boolean` |  | This implies if the app is in collaboration mode |
| [`onPointerUpdate`](#onPointerUpdate) | Function |  | Callback triggered when mouse pointer is updated. |
| [`onExportToBackend`](#onExportToBackend) | Function |  | Callback triggered when link button is clicked on export dialog |
| [`langCode`](#langCode) | string | `en` | Language code string |
| [`renderFooter `](#renderFooter) | Function |  | Function that renders custom UI footer |
| [`viewModeEnabled`](#viewModeEnabled) | boolean |  | This implies if the app is in view mode. |
| [`zenModeEnabled`](#zenModeEnabled) | boolean |  | This implies if the zen mode is enabled |
| [`gridModeEnabled`](#gridModeEnabled) | boolean |  | This implies if the grid mode is enabled |

#### `width`

This props defines the `width` of the Excalidraw component. Defaults to `window.innerWidth` if not passed.

#### `height`

This props defines the `height` of the Excalidraw component. Defaults to `window.innerHeight` if not passed.

#### `offsetLeft`

This prop defines `left` position relative to which Excalidraw should be rendered. Defaults to `0` if not passed.

#### `offsetTop`

This prop defines `top` position relative to which Excalidraw should be rendered. Defaults to `0` if not passed.

#### `onChange`

Every time component updates, this callback if passed will get triggered and has the below signature.

```js
(excalidrawElements, appState) => void;
```

1.`excalidrawElements`: Array of [excalidrawElements](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78) in the scene.

2.`appState`: [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37) of the scene

Here you can try saving the data to your backend or local storage for example.

#### `initialData`

This helps to load Excalidraw with `initialData`. It must be an object or a [promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) which resolves to an object containing the below optional fields.

| Name | Type | Descrption |
| --- | --- | --- |
| `elements` | [ExcalidrawElement[]](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78) | The elements with which Excalidraw should be mounted. |
| `appState` | [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37) | The App state with which Excalidraw should be mounted. |
| `scrollToCenter` | boolean | This attribute implies whether to scroll to the nearest element to center once Excalidraw is mounted. By default, it will not scroll the nearest element to the center. Make sure you pass `initialData.appState.scrollX` and `initialData.appState.scrollY` when `scrollToCenter` is false so that scroll positions are retained |

```json
{
  "elements": [
    {
      "type": "rectangle",
      "version": 141,
      "versionNonce": 361174001,
      "isDeleted": false,
      "id": "oDVXy8D6rom3H1-LLH2-f",
      "fillStyle": "hachure",
      "strokeWidth": 1,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": 100.50390625,
      "y": 93.67578125,
      "strokeColor": "#000000",
      "backgroundColor": "transparent",
      "width": 186.47265625,
      "height": 141.9765625,
      "seed": 1968410350,
      "groupIds": []
    }
  ],
  "appState": { "zenModeEnabled": true, "viewBackgroundColor": "#AFEEEE" }
}
```

You might want to use this when you want to load excalidraw with some initial elements and app state.

#### `excalidrawRef`

You can pass a `ref` when you want to access some excalidraw APIs. We expose the below APIs:

| API | signature | Usage |
| --- | --- | --- |
| ready | `boolean` | This is set to true once Excalidraw is rendered |
| readyPromise | [resolvablePromise](https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317) | This promise will be resolved with the api once excalidraw has rendered. This will be helpful when you want do some action on the host app once this promise resolves. For this to work you will have to pass ref as shown [here](#readyPromise) |
| updateScene | <pre>(<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L192">sceneData</a>)) => void </pre> | updates the scene with the sceneData |
| resetScene | `({ resetLoadingState: boolean }) => void` | Resets the scene. If `resetLoadingState` is passed as true then it will also force set the loading state to false. |
| getSceneElementsIncludingDeleted | <pre> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a></pre> | Returns all the elements including the deleted in the scene |
| getSceneElements | <pre> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a></pre> | Returns all the elements excluding the deleted in the scene |
| getAppState | <pre> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37">AppState</a></pre> | Returns current appState |
| history | `{ clear: () => void }` | This is the history API. `history.clear()` will clear the history |
| setScrollToCenter | <pre> (<a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>) => void </pre> | sets the elements to center |

#### `readyPromise`

<pre>
const excalidrawRef = { current: { readyPromise: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317">resolvablePromise</a>}}
</pre>

#### `onCollabButtonClick`

This callback is triggered when clicked on the collab button in excalidraw. If not supplied, the collab dialog button is not rendered.

#### `isCollaborating`

This prop indicates if the app is in collaboration mode.

#### `onPointerUpdate`

This callback is triggered when mouse pointer is updated.

```js
({ x, y }, button, pointersMap}) => void;
```

1.`{x, y}`: Pointer coordinates

2.`button`: The position of the button. This will be one of `["down", "up"]`

3.`pointersMap`: [`pointers map`](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L131) of the scene

#### `onExportToBackend`

This callback is triggered when the shareable-link button is clicked in the export dialog. The link button will only be shown if this callback is passed.

```js
(exportedElements, appState, canvas) => void
```

1. `exportedElements`: An array of [non deleted elements](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L87) which needs to be exported.
2. `appState`: [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37) of the scene.
3. `canvas`: The `HTMLCanvasElement` of the scene.

#### `langCode`

Determines the language of the UI. It should be one of the [available language codes](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L14). Defaults to `en` (English). We also export default language and supported languages which you can import as shown below.

```js
import { defaultLang, languages } from "@excalidraw/excalidraw";
```

| name | type |
| --- | --- |
| defaultLang | string |
| languages | [Language[]](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L8) |

#### `renderFooter`

A function that renders (returns JSX) custom UI footer. For example, you can use this to render a language picker that was previously being rendered by Excalidraw itself (for now, you'll need to implement your own language picker).

#### `viewModeEnabled`

This prop indicates whether the app is in `view mode`. When supplied, the value takes precedence over `intialData.appState.viewModeEnabled`, the `view mode` will be fully controlled by the host app, and users won't be able to toggle it from within the app.

#### `zenModeEnabled`

This prop indicates whether the app is in `zen mode`. When supplied, the value takes precedence over `intialData.appState.zenModeEnabled`, the `zen mode` will be fully controlled by the host app, and users won't be able to toggle it from within the app.

#### `gridModeEnabled`

This prop indicates whether the shows the grid. When supplied, the value takes precedence over `intialData.appState.gridModeEnabled`, the grid will be fully controlled by the host app, and users won't be able to toggle it from within the app.

### Extra API's

#### `getSceneVersion`

**How to use**

<pre>
import { getSceneVersion } from "@excalidraw/excalidraw";
getSceneVersion(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>)
</pre>

This function returns the current scene version.

#### `getSyncableElements`

**_Signature_**

<pre>
getSyncableElements(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>):<a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>
</pre>

**How to use**

```js
import { getSyncableElements } from "@excalidraw/excalidraw";
```

This function returns all the deleted elements of the scene.

#### `getElementMap`

**_Signature_**

<pre>
getElementsMap(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>): {[id: string]: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement</a>}
</pre>

**How to use**

```js
import { getElementsMap } from "@excalidraw/excalidraw";
```

This function returns an object where each element is mapped to its id.

**_The below api's will be available in [next version](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/CHANGELOG.md#unreleased)_**

#### `restoreAppState`

**_Signature_**

<pre>
restoreAppState(appState:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L17">ImportedDataState["appState"]</a>, localAppState: Partial<<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37">AppState</a>> | null): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37">AppState</a>
</pre>

**_How to use_**

```js
import { restoreAppState } from "@excalidraw/excalidraw";
```

This function will make sure all the keys have appropriate values in [appState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37) and if any key is missing, it will be set to default value. If you pass `localAppState`, `localAppState` value will be preferred over the `appState` passed in params.

#### `restoreElements`

**_Signature_**

<pre>
restoreElements(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L16">ImportedDataState["elements"]</a>): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>
</pre>

**_How to use_**

```js
import { restoreElements } from "@excalidraw/excalidraw";
```

This function will make sure all properties of element is correctly set and if any attribute is missing, it will be set to default value.

#### `restore`

**_Signature_**

<pre>
restoreElements(data:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L12">ImportedDataState</a>): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L4">DataState</a>
</pre>

**_How to use_**

```js
import { restore } from "@excalidraw/excalidraw";
```

This function makes sure elements and state is set to appropriate values and set to default value if not present. It is combination of [restoreElements](#restoreElements) and [restoreAppState](#restoreAppState)
