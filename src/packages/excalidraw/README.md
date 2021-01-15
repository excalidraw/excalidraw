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

Move the folder `excalidraw-assets` to the path where your assets are served. In the example its served from `public/excalidraw-assets`

### Demo

[Try here](https://codesandbox.io/s/excalidraw-ehlz3).

### Usage

```js
import React, { useEffect, useState, createRef } from "react";
import Excalidraw from "@excalidraw/excalidraw";
import InitialData from "./initialData";

import "@excalidraw/excalidraw/dist/excalidraw.min.css";
import "@excalidraw/excalidraw/dist/fonts.min.css";

import "./styles.css";

export default function App() {
  const excalidrawRef = createRef();

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      <div className="excalidraw-wrapper">
        <Excalidraw
          ref={excalidrawRef}
          width={dimensions.width}
          height={dimensions.height}
          initialData={InitialData}
          onChange={(elements, state) => {
            console.log("Latest elements:", elements, "Latest state:", state);
          }}
          user={{ name: "Excalidraw User" }}
          onPointerUpdate={(pointerData) => console.log(pointerData)}
          onCollabButtonClick={() => {
            window.alert("You clicked on collab button");
          }}
        />
      </div>
    </div>
  );
}
```

[![Edit excalidraw](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/excalidraw-ehlz3?fontsize=14&hidenavigation=1&theme=dark)

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [`width`](#width) | Number | `window.innerWidth` | The width of Excalidraw component |
| [`height`](#height) | Number | `window.innerHeight` | The height of Excalidraw component |
| [`offsetLeft`](#offsetLeft) | Number | `0` | left position relative to which Excalidraw should be rendered |
| [`offsetTop`](#offsetTop) | Number | `0` | top position relative to which Excalidraw should render |
| [`onChange`](#onChange) | Function |  | This callback is triggered whenever the component updates due to any change. This callback will receive the excalidraw elements and the current app state. |
| [`initialData`](#initialData) | <pre>{elements?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement[]</a>, appState?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37">AppState<a> } </pre> | null | The initial data with which app loads. |
| [`user`](#user) | `{ name?: string }` |  | User details. The name refers to the name of the user to be shown |
| [`excalidrawRef`](#excalidrawRef) | [`createRef`](https://reactjs.org/docs/refs-and-the-dom.html#creating-refs) or [`callbackRef`](https://reactjs.org/docs/refs-and-the-dom.html#callback-refs) or <pre>{ current: { readyPromise: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317">resolvablePromise</a> } }</pre> |  | Ref to be passed to Excalidraw |
| [`onCollabButtonClick`](#onCollabButtonClick) | Function |  | Callback to be triggered when the collab button is clicked |
| [`isCollaborating`](#isCollaborating) | `boolean` |  | This implies if the app is in collaboration mode |
| [`onPointerUpdate`](#onPointerUpdate) | Function |  | Callback triggered when mouse pointer is updated. |
| [`onExportToBackend`](#onExportToBackend) | Function |  | Callback triggered when link button is clicked on export dialog |
| [`langCode`](#langCode) | string | `en` | Language code string |
| [`renderFooter `](#renderFooter) | Function |  | Function that renders custom UI footer |

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

| name | type |
| --- | --- |
| elements | [ExcalidrawElement []](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78) |
| appState | [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L37) |

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

#### `user`

This is the user name which shows during collaboration. Defaults to `{name: ''}`.

#### `excalidrawRef`

You can pass a `ref` when you want to access some excalidraw APIs. We expose the below APIs:

| API | signature | Usage |
| --- | --- | --- |
| ready | `boolean` | This is set to true once Excalidraw is rendered |
| readyPromise | [resolvablePromise](https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317) | This promise will be resolved with the api once excalidraw has rendered. This will be helpful when you want do some action on the host app once this promise resolves. For this to work you will have to pass ref as shown [here](#readyPromise) |
| updateScene | <pre>(<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L189">sceneData</a>)) => void </pre> | updates the scene with the sceneData |
| resetScene | `({ resetLoadingState: boolean }) => void` | Resets the scene. If `resetLoadingState` is passed as true then it will also force set the loading state to false. |
| getSceneElementsIncludingDeleted | <pre> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement []</a></pre> | Returns all the elements including the deleted in the scene |
| getSceneElements | <pre> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L78">ExcalidrawElement []</a></pre> | Returns all the elements excluding the deleted in the scene |
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
| languages | [Language []](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L8) |

#### `renderFooter`

A function that renders (returns JSX) custom UI footer. For example, you can use this to render a language picker that was previously being rendered by Excalidraw itself (for now, you'll need to implement your own language picker).
