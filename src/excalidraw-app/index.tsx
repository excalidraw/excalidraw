import React, { useState, useLayoutEffect, useEffect } from "react";

import { LoadingMessage } from "../components/LoadingMessage";

import Excalidraw from "../packages/excalidraw/index";

import { importFromLocalStorage } from "../data/localStorage";

import { ImportedDataState } from "../data/types";
import CollabWrapper from "./collab/CollabWrapper";
import { TopErrorBoundary } from "../components/TopErrorBoundary";

function ExcalidrawApp(props: any) {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

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
    <TopErrorBoundary>
      <CollabWrapper>
        {(context: any) => {
          return (
            <Excalidraw
              ref={context.excalidrawRef}
              width={dimensions.width}
              height={dimensions.height}
              onChange={context.onChange}
              initialData={initialState.data}
              user={{ name: context.username }}
              onCollabButtonClick={context.onCollabButtonClick}
              isCollaborating={context.isCollaborating}
              onPointerUpdate={context.onPointerUpdate}
              collaborators={context.collaborators}
              initializeScene={context.initializeScene}
            />
          );
        }}
      </CollabWrapper>
    </TopErrorBoundary>
  );
}

export default ExcalidrawApp;
