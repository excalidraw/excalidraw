import { useEffect, useState, useRef, useCallback } from "react";

import InitialData from "./initialData";
import Sidebar from "./sidebar/Sidebar";

import "./App.scss";
import initialData from "./initialData";
import { nanoid } from "nanoid";
import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  withBatchedUpdates,
  withBatchedUpdatesThrottled,
} from "../../../utils";
import { DRAGGING_THRESHOLD, EVENT } from "../../../constants";
import { distance2d } from "../../../math";

// This is so that we use the bundled excalidraw.development.js file instead
// of the actual source code

const {
  exportToCanvas,
  exportToSvg,
  exportToBlob,
  exportToClipboard,
  Excalidraw,
  MIME_TYPES,
} = window.ExcalidrawLib;

const COMMENT_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M256 32C114.6 32 .0272 125.1 .0272 240c0 47.63 19.91 91.25 52.91 126.2c-14.88 39.5-45.87 72.88-46.37 73.25c-6.625 7-8.375 17.25-4.625 26C5.818 474.2 14.38 480 24 480c61.5 0 109.1-25.75 139.1-46.25C191.1 442.8 223.3 448 256 448c141.4 0 255.1-93.13 255.1-208S397.4 32 256 32zM256.1 400c-26.75 0-53.12-4.125-78.38-12.12l-22.75-7.125l-19.5 13.75c-14.25 10.12-33.88 21.38-57.5 29c7.375-12.12 14.37-25.75 19.88-40.25l10.62-28l-20.62-21.87C69.82 314.1 48.07 282.2 48.07 240c0-88.25 93.25-160 208-160s208 71.75 208 160S370.8 400 256.1 400z" />
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

export default function App() {
  const excalidrawRef = useRef(null);
  const appRef = useRef(null);

  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [canvasUrl, setCanvasUrl] = useState(null);
  const [exportWithDarkMode, setExportWithDarkMode] = useState(false);
  const [exportEmbedScene, setExportEmbedScene] = useState(false);
  const [theme, setTheme] = useState("light");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [commentIcons, setCommentIcons] = useState({});
  const [comment, setComment] = useState(null);

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
  const renderFooter = () => {
    return (
      <>
        {" "}
        <button
          className="custom-element"
          onClick={() => excalidrawRef.current.setCustomType("comment")}
        >
          {COMMENT_SVG}
        </button>
        <button onClick={() => alert("This is dummy footer")}>
          {" "}
          custom footer{" "}
        </button>
      </>
    );
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

  const onCopy = async (type) => {
    await exportToClipboard({
      elements: excalidrawRef.current.getSceneElements(),
      appState: excalidrawRef.current.getAppState(),
      files: excalidrawRef.current.getFiles(),
      type,
    });
    window.alert(`Copied to clipboard as ${type} sucessfully`);
  };

  const onCustomElementPointerDown = (activeTool, pointerDownState) => {
    if (activeTool.type === "custom" && activeTool.customType === "comment") {
      const { x, y } = pointerDownState.origin;
      setComment({ x, y, value: "" });
    }
  };

  const rerenderCommentIcons = () => {
    const commentIconsElements =
      appRef.current.querySelectorAll(".comment-icon");
    commentIconsElements.forEach((ele) => {
      const id = ele.id;
      const appstate = excalidrawRef.current.getAppState();
      const { x, y } = sceneCoordsToViewportCoords(
        { sceneX: commentIcons[id].x, sceneY: commentIcons[id].y },
        appstate,
      );
      ele.style.left = `${x - 16 - appstate.offsetLeft}px`;
      ele.style.top = `${y - 16 - appstate.offsetTop}px`;
    });
  };

  const onPointerMoveFromPointerDownHandler = (pointerDownState) => {
    return withBatchedUpdatesThrottled((event) => {
      const { x, y } = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        excalidrawRef.current.getAppState(),
      );
      const distance = distance2d(
        pointerDownState.x,
        pointerDownState.y,
        event.clientX,
        event.clientY,
      );
      if (distance > DRAGGING_THRESHOLD) {
        setCommentIcons({
          ...commentIcons,
          [pointerDownState.hitElement.id]: {
            ...commentIcons[pointerDownState.hitElement.id],
            x,
            y,
          },
        });
      }
    });
  };
  const onPointerUpFromPointerDownHandler = (pointerDownState) => {
    return withBatchedUpdates((event) => {
      window.removeEventListener(EVENT.POINTER_MOVE, pointerDownState.onMove);
      window.removeEventListener(EVENT.POINTER_UP, pointerDownState.onUp);
      excalidrawRef.current.setCustomType(null);
      const distance = distance2d(
        pointerDownState.x,
        pointerDownState.y,
        event.clientX,
        event.clientY,
      );
      if (distance === 0) {
        if (!comment) {
          setComment({
            x: pointerDownState.hitElement.x + 60,
            y: pointerDownState.hitElement.y,
            value: pointerDownState.hitElement.value,
            id: pointerDownState.hitElement.id,
          });
        } else {
          setComment(null);
        }
      }
    });
  };
  const renderCommentIcons = () => {
    return Object.values(commentIcons).map((commentIcon) => {
      const appState = excalidrawRef.current.getAppState();
      const { x, y } = sceneCoordsToViewportCoords(
        { sceneX: commentIcon.x, sceneY: commentIcon.y },
        excalidrawRef.current.getAppState(),
      );
      return (
        <div
          id={commentIcon.id}
          key={commentIcon.id}
          style={{
            top: `${y - 16 - appState.offsetTop}px`,
            left: `${x - 16 - appState.offsetLeft}px`,
            position: "absolute",
            zIndex: 1,
            width: "32px",
            height: "32px",
          }}
          className="comment-icon"
          onPointerDown={(event) => {
            event.preventDefault();
            if (comment) {
              commentIcon.value = comment.value;
              saveComment();
            }
            const pointerDownState = {
              x: event.clientX,
              y: event.clientY,
              hitElement: commentIcon,
            };
            const onPointerMove =
              onPointerMoveFromPointerDownHandler(pointerDownState);
            const onPointerUp =
              onPointerUpFromPointerDownHandler(pointerDownState);
            window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
            window.addEventListener(EVENT.POINTER_UP, onPointerUp);

            pointerDownState.onMove = onPointerMove;
            pointerDownState.onUp = onPointerUp;

            excalidrawRef.current.setCustomType("comment");
          }}
        >
          <div className="comment-avatar">
            <img src="doremon.png" alt="doremon" />
          </div>
        </div>
      );
    });
  };

  const saveComment = () => {
    if (!comment.id && !comment.value) {
      setComment(null);
      return;
    }
    const id = comment.id || nanoid();
    setCommentIcons({
      ...commentIcons,
      [id]: {
        x: comment.id ? comment.x - 60 : comment.x,
        y: comment.y,
        id,
        value: comment.value,
      },
    });
    setComment(null);
  };

  const renderComment = () => {
    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: comment.x, sceneY: comment.y },
      excalidrawRef.current.getAppState(),
    );

    return (
      <textarea
        className="comment"
        style={{
          top: `${y - 16}px`,
          left: `${x - 16}px`,
          position: "fixed",
          zIndex: 1,
        }}
        ref={(ref) => {
          setTimeout(() => ref?.focus());
        }}
        placeholder={comment.value ? "Reply" : "Comment"}
        value={comment.value}
        onChange={(event) => {
          setComment({ ...comment, value: event.target.value });
        }}
        onBlur={saveComment}
        onKeyDown={(event) => {
          if (!event.shiftKey && event.key === "Enter") {
            event.preventDefault();
            saveComment();
          }
        }}
      />
    );
  };
  return (
    <div className="App" ref={appRef}>
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
        <div className="excalidraw-wrapper">
          <Excalidraw
            ref={excalidrawRef}
            initialData={initialStatePromiseRef.current.promise}
            onChange={(elements, state) => {
              console.info("Elements :", elements, "State : ", state);
            }}
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
            onCustomElementPointerDown={onCustomElementPointerDown}
            onScrollChange={rerenderCommentIcons}
            onOffsetsChange={rerenderCommentIcons}
          />
          {Object.keys(commentIcons || []).length > 0 && renderCommentIcons()}
          {comment && renderComment()}
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
              appRef.current.querySelector(".export-svg").innerHTML =
                svg.outerHTML;
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
