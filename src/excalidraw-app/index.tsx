import React, { useState, useLayoutEffect, useEffect } from "react";

import { LoadingMessage } from "../components/LoadingMessage";

import Excalidraw from "../packages/excalidraw/index";
import { WithCollaboration } from "./collab/WithCollaboration";

import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";

import { ImportedDataState } from "../data/types";

const onUsernameChange = (username: string) => {
  saveUsernameToLocalStorage(username);
};

function ExcalidrawApp(props: any) {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const {
    context: {
      excalidrawRef,
      onCollaborationStart,
      onCollaborationEnd,
      isCollaborating,
      onPointerUpdate,
      collaborators,
      initializeScene,
      isCollaborationScene,
      onChange,
    },
  } = props;

  useLayoutEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // initial state
  // ---------------------------------------------------------------------------

  const [initialState, setInitialState] = useState<{
    data: ImportedDataState;
    user: {
      name: string | null;
    };
  } | null>(null);

  useEffect(() => {
    setInitialState({
      data: importFromLocalStorage(),
      user: {
        name: importUsernameFromLocalStorage(),
      },
    });
  }, []);

  if (!initialState) {
    return <LoadingMessage />;
  }

  return (
    <Excalidraw
      ref={excalidrawRef}
      width={dimensions.width}
      height={dimensions.height}
      onChange={onChange}
      initialData={initialState.data}
      user={initialState.user}
      onUsernameChange={onUsernameChange}
      onCollaborationEnd={onCollaborationEnd}
      onCollaborationStart={onCollaborationStart}
      isCollaborating={isCollaborating}
      onPointerUpdate={onPointerUpdate}
      collaborators={collaborators}
      initializeScene={initializeScene}
      isCollaborationScene={isCollaborationScene}
    />
  );
}

export default WithCollaboration(ExcalidrawApp);
