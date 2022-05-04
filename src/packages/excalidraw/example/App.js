import { useEffect, useState, useRef, useCallback } from "react";

import InitialData from "./initialData";
import Sidebar from "./sidebar/Sidebar";

import "./App.scss";
import initialData from "./initialData";

// This is so that we use the bundled excalidraw.development.js file instead
// of the actual source code
const {
  exportToCanvas,
  exportToSvg,
  exportToBlob,
  exportToClipboard,
  Excalidraw,
  MIME_TYPES,
  sceneCoordsToViewportCoords,
} = window.ExcalidrawLib;

const STAR_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
    <path d="M287.9 0C297.1 0 305.5 5.25 309.5 13.52L378.1 154.8L531.4 177.5C540.4 178.8 547.8 185.1 550.7 193.7C553.5 202.4 551.2 211.9 544.8 218.2L433.6 328.4L459.9 483.9C461.4 492.9 457.7 502.1 450.2 507.4C442.8 512.7 432.1 513.4 424.9 509.1L287.9 435.9L150.1 509.1C142.9 513.4 133.1 512.7 125.6 507.4C118.2 502.1 114.5 492.9 115.1 483.9L142.2 328.4L31.11 218.2C24.65 211.9 22.36 202.4 25.2 193.7C28.03 185.1 35.5 178.8 44.49 177.5L197.7 154.8L266.3 13.52C270.4 5.249 278.7 0 287.9 0L287.9 0zM287.9 78.95L235.4 187.2C231.9 194.3 225.1 199.3 217.3 200.5L98.98 217.9L184.9 303C190.4 308.5 192.9 316.4 191.6 324.1L171.4 443.7L276.6 387.5C283.7 383.7 292.2 383.7 299.2 387.5L404.4 443.7L384.2 324.1C382.9 316.4 385.5 308.5 391 303L476.9 217.9L358.6 200.5C350.7 199.3 343.9 194.3 340.5 187.2L287.9 78.95z" />
  </svg>
);

const COMMENT_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M256 32C114.6 32 .0272 125.1 .0272 240c0 47.63 19.91 91.25 52.91 126.2c-14.88 39.5-45.87 72.88-46.37 73.25c-6.625 7-8.375 17.25-4.625 26C5.818 474.2 14.38 480 24 480c61.5 0 109.1-25.75 139.1-46.25C191.1 442.8 223.3 448 256 448c141.4 0 255.1-93.13 255.1-208S397.4 32 256 32zM256.1 400c-26.75 0-53.12-4.125-78.38-12.12l-22.75-7.125l-19.5 13.75c-14.25 10.12-33.88 21.38-57.5 29c7.375-12.12 14.37-25.75 19.88-40.25l10.62-28l-20.62-21.87C69.82 314.1 48.07 282.2 48.07 240c0-88.25 93.25-160 208-160s208 71.75 208 160S370.8 400 256.1 400z" />
  </svg>
);

const THUMBS_UP_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M96 191.1H32c-17.67 0-32 14.33-32 31.1v223.1c0 17.67 14.33 31.1 32 31.1h64c17.67 0 32-14.33 32-31.1V223.1C128 206.3 113.7 191.1 96 191.1zM512 227c0-36.89-30.05-66.92-66.97-66.92h-99.86C354.7 135.1 360 113.5 360 100.8c0-33.8-26.2-68.78-70.06-68.78c-46.61 0-59.36 32.44-69.61 58.5c-31.66 80.5-60.33 66.39-60.33 93.47c0 12.84 10.36 23.99 24.02 23.99c5.256 0 10.55-1.721 14.97-5.26c76.76-61.37 57.97-122.7 90.95-122.7c16.08 0 22.06 12.75 22.06 20.79c0 7.404-7.594 39.55-25.55 71.59c-2.046 3.646-3.066 7.686-3.066 11.72c0 13.92 11.43 23.1 24 23.1h137.6C455.5 208.1 464 216.6 464 227c0 9.809-7.766 18.03-17.67 18.71c-12.66 .8593-22.36 11.4-22.36 23.94c0 15.47 11.39 15.95 11.39 28.91c0 25.37-35.03 12.34-35.03 42.15c0 11.22 6.392 13.03 6.392 22.25c0 22.66-29.77 13.76-29.77 40.64c0 4.515 1.11 5.961 1.11 9.456c0 10.45-8.516 18.95-18.97 18.95h-52.53c-25.62 0-51.02-8.466-71.5-23.81l-36.66-27.51c-4.315-3.245-9.37-4.811-14.38-4.811c-13.85 0-24.03 11.38-24.03 24.04c0 7.287 3.312 14.42 9.596 19.13l36.67 27.52C235 468.1 270.6 480 306.6 480h52.53c35.33 0 64.36-27.49 66.8-62.2c17.77-12.23 28.83-32.51 28.83-54.83c0-3.046-.2187-6.107-.6406-9.122c17.84-12.15 29.28-32.58 29.28-55.28c0-5.311-.6406-10.54-1.875-15.64C499.9 270.1 512 250.2 512 227z" />
  </svg>
);

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
  const excalidrawRef = useRef(null);
  const excalidrawWrapperRef = useRef(null);
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
  useEffect(() => {
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
        excalidrawRef.current.addFiles(imagesArray);
      };
    };
    fetchData();

    const onHashChange = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const libraryUrl = hash.get("addLibrary");
      if (libraryUrl) {
        excalidrawRef.current.importLibrary(libraryUrl, hash.get("token"));
      }
    };
    window.addEventListener("hashchange", onHashChange, false);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
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

  const renderCustomElementWidget = () => {
    return (
      <>
        <button
          className="custom-element"
          onClick={() => {
            excalidrawRef.current.setCustomType("star");
          }}
        >
          {STAR_SVG}
        </button>
        <button
          className="custom-element"
          onClick={() => {
            excalidrawRef.current.setCustomType("comment");
          }}
        >
          {COMMENT_SVG}
        </button>
        <button
          className="custom-element"
          onClick={() => {
            excalidrawRef.current.setCustomType("thumbsup");
          }}
        >
          {THUMBS_UP_SVG}
        </button>
      </>
    );
  };

  const onCreate = (element) => {
    setTimeout(() => addTextArea(element), 0);
  };

  const getCustomElementsConfig = () => {
    return {
      star: {
        type: "custom",
        customType: "star",
        displayData: {
          type: "svg",
          content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
        <path d="M287.9 0C297.1 0 305.5 5.25 309.5 13.52L378.1 154.8L531.4 177.5C540.4 178.8 547.8 185.1 550.7 193.7C553.5 202.4 551.2 211.9 544.8 218.2L433.6 328.4L459.9 483.9C461.4 492.9 457.7 502.1 450.2 507.4C442.8 512.7 432.1 513.4 424.9 509.1L287.9 435.9L150.1 509.1C142.9 513.4 133.1 512.7 125.6 507.4C118.2 502.1 114.5 492.9 115.1 483.9L142.2 328.4L31.11 218.2C24.65 211.9 22.36 202.4 25.2 193.7C28.03 185.1 35.5 178.8 44.49 177.5L197.7 154.8L266.3 13.52C270.4 5.249 278.7 0 287.9 0L287.9 0zM287.9 78.95L235.4 187.2C231.9 194.3 225.1 199.3 217.3 200.5L98.98 217.9L184.9 303C190.4 308.5 192.9 316.4 191.6 324.1L171.4 443.7L276.6 387.5C283.7 383.7 292.2 383.7 299.2 387.5L404.4 443.7L384.2 324.1C382.9 316.4 385.5 308.5 391 303L476.9 217.9L358.6 200.5C350.7 199.3 343.9 194.3 340.5 187.2L287.9 78.95z" />
      </svg>`,
        },
        width: 60,
        height: 60,
        disableContextMenu: true,
      },
      comment: {
        type: "custom",
        customType: "comment",
        displayData: {
          type: "svg",
          content: () =>
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path d="M256 32C114.6 32 .0272 125.1 .0272 240c0 47.63 19.91 91.25 52.91 126.2c-14.88 39.5-45.87 72.88-46.37 73.25c-6.625 7-8.375 17.25-4.625 26C5.818 474.2 14.38 480 24 480c61.5 0 109.1-25.75 139.1-46.25C191.1 442.8 223.3 448 256 448c141.4 0 255.1-93.13 255.1-208S397.4 32 256 32zM256.1 400c-26.75 0-53.12-4.125-78.38-12.12l-22.75-7.125l-19.5 13.75c-14.25 10.12-33.88 21.38-57.5 29c7.375-12.12 14.37-25.75 19.88-40.25l10.62-28l-20.62-21.87C69.82 314.1 48.07 282.2 48.07 240c0-88.25 93.25-160 208-160s208 71.75 208 160S370.8 400 256.1 400z" />
      </svg>`,
        },
        transformHandles: false,
        stackedOnTop: true,
        onCreate,
        disableContextMenu: true,
      },
      thumbsup: {
        type: "custom",
        customType: "thumbsup",
        displayData: {
          type: "dataURL",
          content: () => {
            return new Promise((resolve, reject) => {
              const image = document.createElement("img");
              image.crossOrigin = "Anonymous";
              image.src =
                "https://upload.wikimedia.org/wikipedia/commons/1/1f/SMirC-thumbsup.svg";

              image.onload = function () {
                const canvas = document.createElement("canvas");
                canvas.width = 30 * window.devicePixelRatio;
                canvas.height = 30 * window.devicePixelRatio;
                const context = canvas.getContext("2d");
                context.scale(window.devicePixelRatio, window.devicePixelRatio);
                context.drawImage(image, 5, 5, 20, 20);
                resolve(canvas.toDataURL());
              };
              image.onerror = (err) => reject(err);
            });
          },
        },
      },
    };
  };

  const addTextArea = (element) => {
    const { x: viewPortX, y: viewPortY } = sceneCoordsToViewportCoords(
      {
        sceneX: element.x,
        sceneY: element.y,
      },
      excalidrawRef.current.getAppState(),
    );
    const textarea = document.createElement("textarea");
    Object.assign(textarea.style, {
      position: "absolute",
      display: "inline-block",
      left: `${viewPortX + element.width / 2}px`,
      top: `${viewPortY + element.height / 2}px`,
      height: `${100}px`,
      width: `${100}px`,
      zIndex: 10,
      className: "comment-textarea",
      whiteSpace: "pre-wrap",
      fontSize: "13px",
    });
    textarea.placeholder = "Start typing your comments";

    textarea.onblur = () => {
      textarea.remove();
    };
    excalidrawWrapperRef.current.querySelector(".excalidraw").append(textarea);
    textarea.focus();
  };

  const onElementClick = (element) => {
    if (element.type === "custom" && element.customType === "comment") {
      addTextArea(element);
    }
  };
  const onCopy = async (type) => {
    await exportToClipboard({
      elements: excalidrawRef.current.getSceneElements(),
      appState: excalidrawRef.current.getAppState(),
      files: excalidrawRef.current.getFiles(),
      type,
    });
    window.alert(`Copied to clipboard as ${type} sucessfully`);
  };

  return (
    <div className="App">
      <h1> Excalidraw Example</h1>
      <Sidebar>
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
          <button
            onClick={() => {
              excalidrawRef.current.updateScene({
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
                  excalidrawRef.current.updateScene({ collaborators });
                } else {
                  excalidrawRef.current.updateScene({
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
        <div className="excalidraw-wrapper" ref={excalidrawWrapperRef}>
          <Excalidraw
            ref={excalidrawRef}
            initialData={initialStatePromiseRef.current.promise}
            onChange={(elements, state) =>
              console.info("Elements :", elements, "State : ", state)
            }
            //onPointerUpdate={(payload) => console.info(payload)}
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
            renderCustomElementWidget={renderCustomElementWidget}
            customElementsConfig={getCustomElementsConfig()}
            onElementClick={onElementClick}
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
                elements: excalidrawRef.current.getSceneElements(),
                appState: {
                  ...initialData.appState,
                  exportWithDarkMode,
                  exportEmbedScene,
                  width: 300,
                  height: 100,
                },
                embedScene: true,
                files: excalidrawRef.current.getFiles(),
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
                elements: excalidrawRef.current.getSceneElements(),
                mimeType: "image/png",
                appState: {
                  ...initialData.appState,
                  exportEmbedScene,
                  exportWithDarkMode,
                },
                files: excalidrawRef.current.getFiles(),
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
                elements: excalidrawRef.current.getSceneElements(),
                appState: {
                  ...initialData.appState,
                  exportWithDarkMode,
                },
                files: excalidrawRef.current.getFiles(),
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
