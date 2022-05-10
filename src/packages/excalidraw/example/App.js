import { useEffect, useState, useRef, useCallback } from "react";

import InitialData from "./initialData";
import Sidebar from "./sidebar/Sidebar";

import "./App.scss";
import initialData from "./initialData";
import { fileOpen } from "../../../data/filesystem";
import { loadSceneOrLibraryFromBlob } from "../../utils";

// This is so that we use the bundled excalidraw.development.js file instead
// of the actual source code

const {
  exportToCanvas,
  exportToSvg,
  exportToBlob,
  exportToClipboard,
  Excalidraw,
  useHandleLibrary,
  MIME_TYPES,
} = window.ExcalidrawLib;

const resolvablePromise = () => {
  let resolve;
  let reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
};

const renderTopRightUI = () => {
  return (
    <button
      onClick={() => alert("This is dummy top right UI")}
      style={{ height: "2.5rem" }}
    >
      {" "}
      Click me{" "}
    </button>
  );
};

const renderFooter = () => {
  return (
    <button onClick={() => alert("This is dummy footer")}>
      {" "}
      custom footer{" "}
    </button>
  );
};

export default function App() {
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [canvasUrl, setCanvasUrl] = useState(null);
  const [exportWithDarkMode, setExportWithDarkMode] = useState(false);
  const [exportEmbedScene, setExportEmbedScene] = useState(false);
  const [theme, setTheme] = useState("light");
  const [isCollaborating, setIsCollaborating] = useState(false);

  const initialStatePromiseRef = useRef({ promise: null });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise = resolvablePromise();
  }

  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  useHandleLibrary({ excalidrawAPI });

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const fetchData = async () => {
      const res = await fetch("/rocket.jpeg");
      const imageData = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(imageData);

      reader.onload = function () {
        const imagesArray = [
          {
            id: "rocket",
            dataURL: reader.result,
            mimeType: MIME_TYPES.jpg,
            created: 1644915140367,
          },
        ];

        initialStatePromiseRef.current.promise.resolve(InitialData);
        excalidrawAPI.addFiles(imagesArray);
      };
    };
    fetchData();
  }, [excalidrawAPI]);

  const loadSceneOrLibrary = async () => {
    const file = await fileOpen({ description: "Excalidraw or library file" });
    const contents = await loadSceneOrLibraryFromBlob(file, null, null);
    if (contents.type === MIME_TYPES.excalidraw) {
      excalidrawAPI.updateScene(contents.data);
    } else if (contents.type === MIME_TYPES.excalidrawlib) {
      excalidrawAPI.updateLibrary({
        libraryItems: contents.data.libraryItems,
        openLibraryMenu: true,
      });
    }
  };

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
    excalidrawAPI.updateScene(sceneData);
  };

  const onLinkOpen = useCallback((element, event) => {
    const link = element.link;
    const { nativeEvent } = event.detail;
    const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
    const isNewWindow = nativeEvent.shiftKey;
    const isInternalLink =
      link.startsWith("/") || link.includes(window.location.origin);
    if (isInternalLink && !isNewTab && !isNewWindow) {
      // signal that we're handling the redirect ourselves
      event.preventDefault();
      // do a custom redirect, such as passing to react-router
      // ...
    }
  }, []);

  const onCopy = async (type) => {
    await exportToClipboard({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      type,
    });
    window.alert(`Copied to clipboard as ${type} sucessfully`);
  };

  return (
    <div className="App">
      <h1> Excalidraw Example</h1>
      <Sidebar>
        <div className="button-wrapper">
          <button onClick={loadSceneOrLibrary}>Load Scene or Library</button>
          <button className="update-scene" onClick={updateScene}>
            Update Scene
          </button>
          <button
            className="reset-scene"
            onClick={() => {
              excalidrawAPI.resetScene();
            }}
          >
            Reset Scene
          </button>
          <button
            onClick={() => {
              excalidrawAPI.updateLibrary({
                libraryItems: [
                  {
                    status: "published",
                    elements: initialData.libraryItems[0],
                  },
                  {
                    status: "unpublished",
                    elements: initialData.libraryItems[1],
                  },
                ],
              });
            }}
          >
            Update Library
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
          <label>
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={() => {
                let newTheme = "light";
                if (theme === "light") {
                  newTheme = "dark";
                }
                setTheme(newTheme);
              }}
            />
            Switch to Dark Theme
          </label>
          <label>
            <input
              type="checkbox"
              checked={isCollaborating}
              onChange={() => {
                if (!isCollaborating) {
                  const collaborators = new Map();
                  collaborators.set("id1", {
                    username: "Doremon",
                    src: "doremon.png",
                  });
                  collaborators.set("id2", {
                    username: "Excalibot",
                    src: "https://avatars.githubusercontent.com/excalibot",
                  });
                  collaborators.set("id3", {
                    username: "Pika",
                    src: "pika.jpeg",
                  });
                  excalidrawAPI.updateScene({ collaborators });
                } else {
                  excalidrawAPI.updateScene({
                    collaborators: new Map(),
                  });
                }
                setIsCollaborating(!isCollaborating);
              }}
            />
            Show collaborators
          </label>
          <div>
            <button onClick={onCopy.bind(null, "png")}>
              Copy to Clipboard as PNG
            </button>
            <button onClick={onCopy.bind(null, "svg")}>
              Copy to Clipboard as SVG
            </button>
            <button onClick={onCopy.bind(null, "json")}>
              Copy to Clipboard as JSON
            </button>
          </div>
        </div>
        <div className="excalidraw-wrapper">
          <Excalidraw
            ref={(api) => setExcalidrawAPI(api)}
            initialData={initialStatePromiseRef.current.promise}
            onChange={(elements, state) =>
              console.info("Elements :", elements, "State : ", state)
            }
            onPointerUpdate={(payload) => console.info(payload)}
            onCollabButtonClick={() =>
              window.alert("You clicked on collab button")
            }
            viewModeEnabled={viewModeEnabled}
            zenModeEnabled={zenModeEnabled}
            gridModeEnabled={gridModeEnabled}
            theme={theme}
            name="Custom name of drawing"
            UIOptions={{ canvasActions: { loadScene: false } }}
            renderTopRightUI={renderTopRightUI}
            renderFooter={renderFooter}
            onLinkOpen={onLinkOpen}
          />
        </div>

        <div className="export-wrapper button-wrapper">
          <label className="export-wrapper__checkbox">
            <input
              type="checkbox"
              checked={exportWithDarkMode}
              onChange={() => setExportWithDarkMode(!exportWithDarkMode)}
            />
            Export with dark mode
          </label>
          <label className="export-wrapper__checkbox">
            <input
              type="checkbox"
              checked={exportEmbedScene}
              onChange={() => setExportEmbedScene(!exportEmbedScene)}
            />
            Export with embed scene
          </label>
          <button
            onClick={async () => {
              const svg = await exportToSvg({
                elements: excalidrawAPI.getSceneElements(),
                appState: {
                  ...initialData.appState,
                  exportWithDarkMode,
                  exportEmbedScene,
                  width: 300,
                  height: 100,
                },
                embedScene: true,
                files: excalidrawAPI.getFiles(),
              });
              document.querySelector(".export-svg").innerHTML = svg.outerHTML;
            }}
          >
            Export to SVG
          </button>
          <div className="export export-svg"></div>

          <button
            onClick={async () => {
              const blob = await exportToBlob({
                elements: excalidrawAPI.getSceneElements(),
                mimeType: "image/png",
                appState: {
                  ...initialData.appState,
                  exportEmbedScene,
                  exportWithDarkMode,
                },
                files: excalidrawAPI.getFiles(),
              });
              setBlobUrl(window.URL.createObjectURL(blob));
            }}
          >
            Export to Blob
          </button>
          <div className="export export-blob">
            <img src={blobUrl} alt="" />
          </div>

          <button
            onClick={async () => {
              const canvas = await exportToCanvas({
                elements: excalidrawAPI.getSceneElements(),
                appState: {
                  ...initialData.appState,
                  exportWithDarkMode,
                },
                files: excalidrawAPI.getFiles(),
              });
              const ctx = canvas.getContext("2d");
              ctx.font = "30px Virgil";
              ctx.strokeText("My custom text", 50, 60);
              setCanvasUrl(canvas.toDataURL());
            }}
          >
            Export to Canvas
          </button>
          <div className="export export-canvas">
            <img src={canvasUrl} alt="" />
          </div>
        </div>
      </Sidebar>
    </div>
  );
}
