import React, { useState, useLayoutEffect, useEffect } from "react";

import { LoadingMessage } from "../components/LoadingMessage";

import Excalidraw from "../packages/excalidraw/index";
import { WithCollaboration } from "./collab/WithCollaboration";

import { importFromLocalStorage } from "../data/localStorage";

import { ImportedDataState } from "../data/types";

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
      isCollaborating,
      onPointerUpdate,
      collaborators,
      initializeScene,
      onChange,
      username,
      onCollabButtonClick,
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
  } | null>(null);

  useEffect(() => {
    setInitialState({
      data: importFromLocalStorage(),
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
      user={{ name: username }}
      onCollabButtonClick={onCollabButtonClick}
      isCollaborating={isCollaborating}
      onPointerUpdate={onPointerUpdate}
      collaborators={collaborators}
      initializeScene={initializeScene}
    />
  );
}

export default WithCollaboration(ExcalidrawApp);
