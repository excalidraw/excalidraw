# Integration

### Web Bundler

If you are using a Web bundler (for instance, Webpack), you can import it as an ES6 module as shown below

<details><summary><strong>View Example</strong></summary>

```js
import React, { useEffect, useState, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import InitialData from "./initialData";

import "./styles.scss";

export default function App() {
  const excalidrawRef = useRef(null);

  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);

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
      <div className="excalidraw-wrapper">
        <Excalidraw
          ref={excalidrawRef}
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

To view the full example visit :point_down:

[![Edit excalidraw](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/excalidraw-ehlz3?fontsize=14&hidenavigation=1&theme=dark)

</details>

Since Excalidraw doesn't support server side rendering yet, you should render the component once the host is mounted.

```js
import { useState, useEffect } from "react";
export default function IndexPage() {
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    import("@excalidraw/excalidraw").then((comp) => setComp(comp.default));
  }, []);
  return <>{Comp && <Comp />}</>;
}
```

The `types` are available at `@excalidraw/excalidraw/types`, you can view [example for typescript](https://codesandbox.io/s/excalidraw-types-9h2dm)

### In Browser

To use it in a browser directly:

For development use :point_down:

```js
<script
  type="text/javascript"
  src="https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.development.js"
></script>
```

For production use :point_down:

```js
<script
  type="text/javascript"
  src="https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.production.min.js"
></script>
```

You will need to make sure `react`, `react-dom` is available as shown in the below example. For prod please use the production versions of `react`, `react-dom`.

<details><summary><strong>View Example</strong></summary>

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
      src="https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.development.js"
    ></script>
  </head>

  <body>
    <div class="container">
      <h1>Excalidraw Embed Example</h1>
      <div id="app"></div>
    </div>
    <script type="text/javascript" src="src/index.js"></script>
  </body>
</html>
```

```js
/*eslint-disable */
import "./styles.css";
import InitialData from "./initialData";

const App = () => {
  const excalidrawRef = React.useRef(null);

  const [viewModeEnabled, setViewModeEnabled] = React.useState(false);
  const [zenModeEnabled, setZenModeEnabled] = React.useState(false);
  const [gridModeEnabled, setGridModeEnabled] = React.useState(false);

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

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "button-wrapper" },
      React.createElement(
        "button",
        {
          className: "update-scene",
          onClick: updateScene,
        },
        "Update Scene",
      ),
      React.createElement(
        "button",
        {
          className: "reset-scene",
          onClick: () => excalidrawRef.current.resetScene(),
        },
        "Reset Scene",
      ),
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: viewModeEnabled,
          onChange: () => setViewModeEnabled(!viewModeEnabled),
        }),
        "View mode",
      ),
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: zenModeEnabled,
          onChange: () => setZenModeEnabled(!zenModeEnabled),
        }),
        "Zen mode",
      ),
      React.createElement(
        "label",
        null,
        React.createElement("input", {
          type: "checkbox",
          checked: gridModeEnabled,
          onChange: () => setGridModeEnabled(!gridModeEnabled),
        }),
        "Grid mode",
      ),
    ),
    React.createElement(
      "div",
      {
        className: "excalidraw-wrapper",
        ref: excalidrawWrapperRef,
      },
      React.createElement(ExcalidrawLib.Excalidraw, {
        initialData: InitialData,
        onChange: (elements, state) =>
          console.log("Elements :", elements, "State : ", state),
        onPointerUpdate: (payload) => console.log(payload),
        onCollabButtonClick: () => window.alert("You clicked on collab button"),
        viewModeEnabled: viewModeEnabled,
        zenModeEnabled: zenModeEnabled,
        gridModeEnabled: gridModeEnabled,
      }),
    ),
  );
};

onst excalidrawWrapper = document.getElementById("app");

ReactDOM.render(React.createElement(App), excalidrawWrapper);
```

To view the full example visit :point_down:

[![Edit excalidraw-in-browser](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/excalidraw-in-browser-tlqom?fontsize=14&hidenavigation=1&theme=dark)

</details>
