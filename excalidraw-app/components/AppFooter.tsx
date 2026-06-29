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
  "maxZoom" | "minZoom" | "padding" | "tolerance"
>;

const ScrollConstraintsDebugFooter = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [activeLock, setActiveLock] = useState<ScrollConstraints | null>(null);
  const [options, setOptions] = useState<ScrollConstraintOptions>({
    tolerance: 0,
    minZoom: undefined,
    maxZoom: undefined,
    padding: [0, 0, 0, 0],
  });

  const setLock = useCallback(
    (nextLock: ScrollConstraints) => {
      // pass an empty target so the constraints are applied without scrolling
      excalidrawAPI?.scrollToContent([], { scrollConstraints: nextLock });
      setActiveLock(nextLock);
    },
    [excalidrawAPI],
  );

  const getSelectedElementsForScrollLock = useCallback(() => {
    if (!excalidrawAPI) {
      return [];
    }

    return getSelectedElements(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      {
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      },
    );
  }, [excalidrawAPI]);

  const getScrollConstraintsFromBounds = useCallback(
    ([x1, y1, x2, y2]: readonly [number, number, number, number]) => ({
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      ...options,
    }),
    [options],
  );

  const toggleScrollLock = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    if (activeLock) {
      excalidrawAPI.scrollToContent([], { scrollConstraints: null });
      setActiveLock(null);
      return;
    }

    const selectedElements = getSelectedElementsForScrollLock();
    const [x1, y1, x2, y2] = selectedElements.length
      ? getCommonBounds(
          selectedElements,
          excalidrawAPI.getSceneElementsMapIncludingDeleted(),
        )
      : getVisibleSceneBounds(excalidrawAPI.getAppState());

    setLock(getScrollConstraintsFromBounds([x1, y1, x2, y2]));
  }, [
    activeLock,
    excalidrawAPI,
    getScrollConstraintsFromBounds,
    getSelectedElementsForScrollLock,
    setLock,
  ]);

  const scrollToSelectionWithLock = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    const selectedElements = getSelectedElementsForScrollLock();

    if (!selectedElements.length) {
      return;
    }

    const scrollConstraints = getScrollConstraintsFromBounds(
      getCommonBounds(
        selectedElements,
        excalidrawAPI.getSceneElementsMapIncludingDeleted(),
      ),
    );

    excalidrawAPI.scrollToContent(selectedElements, {
      animate: true,
      scrollConstraints,
    });
    setActiveLock(scrollConstraints);
  }, [
    excalidrawAPI,
    getScrollConstraintsFromBounds,
    getSelectedElementsForScrollLock,
  ]);

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
    (option: "maxZoom" | "minZoom" | "tolerance", value: string) => {
      updateOptions({
        ...options,
        [option]: value === "" ? undefined : Number(value),
      });
    },
    [options, updateOptions],
  );

  const updatePadding = useCallback(
    (side: "bottom" | "left" | "right" | "top", value: string) => {
      const nextPadding = value === "" ? undefined : Number(value);
      const [top = 0, right = 0, bottom = 0, left = 0] = options.padding ?? [];
      const padding = {
        bottom,
        left,
        right,
        top,
        [side]: nextPadding,
      };

      updateOptions({
        ...options,
        padding: [
          padding.top ?? 0,
          padding.right ?? 0,
          padding.bottom ?? 0,
          padding.left ?? 0,
        ],
      });
    },
    [options, updateOptions],
  );

  const [paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0] =
    options.padding ?? [];

  return (
    <div
      style={{
        display: "flex",
        gap: ".35rem",
        alignItems: "center",
        padding: "0 .35rem",
        fontSize: 12,
      }}
    >
      <button onClick={toggleScrollLock}>
        {activeLock ? "disable scroll lock" : "lock scroll"}
      </button>
      <button onClick={scrollToSelectionWithLock}>scroll + lock</button>
      <label
        style={{
          display: "flex",
          gap: ".25rem",
          alignItems: "center",
        }}
      >
        tolerance
        <input
          type="number"
          min={0}
          step={1}
          value={options.tolerance ?? ""}
          onChange={(event) =>
            updateNumberOption("tolerance", event.target.value)
          }
          style={{ width: 56 }}
        />
      </label>
      <label
        style={{
          display: "flex",
          gap: ".25rem",
          alignItems: "center",
        }}
      >
        min zoom
        <input
          type="number"
          min={0}
          step={0.1}
          value={options.minZoom ?? ""}
          onChange={(event) =>
            updateNumberOption("minZoom", event.target.value)
          }
          style={{ width: 56 }}
        />
      </label>
      <label
        style={{
          display: "flex",
          gap: ".25rem",
          alignItems: "center",
        }}
      >
        max zoom
        <input
          type="number"
          min={0}
          step={0.1}
          value={options.maxZoom ?? ""}
          onChange={(event) =>
            updateNumberOption("maxZoom", event.target.value)
          }
          style={{ width: 56 }}
        />
      </label>
      {(
        [
          ["top", paddingTop],
          ["right", paddingRight],
          ["bottom", paddingBottom],
          ["left", paddingLeft],
        ] as const
      ).map(([side, value]) => (
        <label
          key={side}
          style={{
            display: "flex",
            gap: ".25rem",
            alignItems: "center",
          }}
        >
          {`pad ${side}`}
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(event) => updatePadding(side, event.target.value)}
            style={{ width: 48 }}
          />
        </label>
      ))}
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
