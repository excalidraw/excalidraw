import { Footer } from "@excalidraw/excalidraw/index";
import {
  getCommonBounds,
  getSelectedElements,
  getVisibleSceneBounds,
} from "@excalidraw/element";
import React, { useCallback, useState } from "react";

import type {
  ExcalidrawImperativeAPI,
  ScrollConstraints,
} from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

type ScrollConstraintOptions = Pick<
  ScrollConstraints,
  "lockZoom" | "overscrollAllowance" | "viewportZoomFactor"
>;

const ScrollConstraintsDebugFooter = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [activeLock, setActiveLock] = useState<ScrollConstraints | null>(null);
  const [options, setOptions] = useState<ScrollConstraintOptions>({
    lockZoom: false,
    overscrollAllowance: 0.2,
    viewportZoomFactor: 0.2,
  });

  const setLock = useCallback(
    (nextLock: ScrollConstraints) => {
      excalidrawAPI?.setScrollConstraints(nextLock);
      setActiveLock(nextLock);
    },
    [excalidrawAPI],
  );

  const toggleScrollLock = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    if (activeLock) {
      excalidrawAPI.setScrollConstraints(null);
      setActiveLock(null);
      return;
    }

    const selectedElements = getSelectedElements(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      {
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      },
    );
    const [x1, y1, x2, y2] = selectedElements.length
      ? getCommonBounds(
          selectedElements,
          excalidrawAPI.getSceneElementsMapIncludingDeleted(),
        )
      : getVisibleSceneBounds(excalidrawAPI.getAppState());

    setLock({
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      ...options,
    });
  }, [activeLock, excalidrawAPI, options, setLock]);

  const updateOptions = useCallback(
    (nextOptions: ScrollConstraintOptions) => {
      setOptions(nextOptions);

      if (activeLock) {
        setLock({ ...activeLock, ...nextOptions });
      }
    },
    [activeLock, setLock],
  );

  const updateNumberOption = useCallback(
    (option: "overscrollAllowance" | "viewportZoomFactor", value: string) => {
      updateOptions({
        ...options,
        [option]: value === "" ? undefined : Number(value),
      });
    },
    [options, updateOptions],
  );

  const updateBooleanOption = useCallback(
    (option: "lockZoom", value: boolean) => {
      updateOptions({
        ...options,
        [option]: value,
      });
    },
    [options, updateOptions],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: ".45rem",
        alignItems: "center",
        padding: "0 .35rem",
        fontSize: 12,
      }}
    >
      <button
        className="ToolIcon_type_button"
        type="button"
        onClick={toggleScrollLock}
      >
        {activeLock ? "disable scroll lock" : "lock scroll"}
      </button>
      <label style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
        overscroll
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={options.overscrollAllowance ?? ""}
          onChange={(event) =>
            updateNumberOption("overscrollAllowance", event.target.value)
          }
          style={{ width: 56 }}
        />
      </label>
      <label style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
        zoom factor
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={options.viewportZoomFactor ?? ""}
          onChange={(event) =>
            updateNumberOption("viewportZoomFactor", event.target.value)
          }
          style={{ width: 56 }}
        />
      </label>
      <label style={{ display: "flex", gap: ".2rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={!!options.lockZoom}
          onChange={(event) =>
            updateBooleanOption("lockZoom", event.target.checked)
          }
        />
        lock zoom
      </label>
    </div>
  );
};

export const AppFooter = React.memo(
  ({
    excalidrawAPI,
    onChange,
  }: {
    excalidrawAPI: ExcalidrawImperativeAPI | null;
    onChange: () => void;
  }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          <ScrollConstraintsDebugFooter excalidrawAPI={excalidrawAPI} />
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
        </div>
      </Footer>
    );
  },
);
