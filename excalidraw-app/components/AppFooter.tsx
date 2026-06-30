import { Footer } from "@excalidraw/excalidraw/index";
import {
  getSelectedElements,
  getVisibleSceneBounds,
} from "@excalidraw/element";
import React, { useCallback, useState } from "react";

import type {
  ExcalidrawImperativeAPI,
  Offsets,
} from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

type ScrollToArgs = NonNullable<
  Parameters<ExcalidrawImperativeAPI["scrollTo"]>[0]
>;
type ScrollToBehavior = ScrollToArgs["behavior"];
type LockOptions = NonNullable<ScrollToArgs["lock"]>;

const OFFSET_SIDES = ["top", "right", "bottom", "left"] as const;

const ScrollConstraintsDebugFooter = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [locked, setLocked] = useState(false);
  const [behavior, setBehavior] = useState<ScrollToBehavior>("zoomToFit");
  const [lock, setLock] = useState<LockOptions>({
    scroll: true,
    zoom: false,
    tolerance: 0,
  });
  const [offset, setOffset] = useState<Offsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  const getSelectedElementsForLock = useCallback(() => {
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

  // (re)lock the current viewport in place (no navigation) with the given lock
  const lockCurrentView = useCallback(
    (nextLock: LockOptions, nextOffset: Offsets) => {
      if (!excalidrawAPI) {
        return;
      }
      excalidrawAPI.scrollTo({
        target: getVisibleSceneBounds(excalidrawAPI.getAppState()),
        behavior: "panOnly",
        animation: false,
        lock: nextLock,
        offset: nextOffset,
      });
      setLocked(true);
    },
    [excalidrawAPI],
  );

  const toggleLock = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    if (locked) {
      excalidrawAPI.scrollTo(null);
      setLocked(false);
      return;
    }
    lockCurrentView(lock, offset);
  }, [excalidrawAPI, locked, lock, offset, lockCurrentView]);

  const scrollToSelectionWithLock = useCallback(() => {
    const selectedElements = getSelectedElementsForLock();
    if (!excalidrawAPI || !selectedElements.length) {
      return;
    }
    excalidrawAPI.scrollTo({
      target: selectedElements,
      behavior,
      animation: true,
      lock,
      offset,
    });
    setLocked(true);
  }, [excalidrawAPI, behavior, lock, offset, getSelectedElementsForLock]);

  const updateLock = useCallback(
    (nextLock: LockOptions) => {
      setLock(nextLock);
      if (locked) {
        lockCurrentView(nextLock, offset);
      }
    },
    [locked, offset, lockCurrentView],
  );

  const updateOffset = useCallback(
    (side: typeof OFFSET_SIDES[number], value: string) => {
      const nextOffset = {
        ...offset,
        [side]: value === "" ? 0 : Number(value),
      };
      setOffset(nextOffset);
      if (locked) {
        lockCurrentView(lock, nextOffset);
      }
    },
    [offset, lock, locked, lockCurrentView],
  );

  const labelStyle = {
    display: "flex",
    gap: ".25rem",
    alignItems: "center",
  } as const;

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
      <button onClick={toggleLock}>
        {locked ? "disable lock" : "lock view"}
      </button>
      <button onClick={scrollToSelectionWithLock}>scroll + lock</button>
      <label style={labelStyle}>
        behavior
        <select
          value={behavior}
          onChange={(event) =>
            setBehavior(event.target.value as ScrollToBehavior)
          }
        >
          <option value="panOnly">panOnly</option>
          <option value="zoomToFit">zoomToFit</option>
          <option value="zoomToTarget">zoomToTarget</option>
        </select>
      </label>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={!!lock.scroll}
          onChange={(event) =>
            updateLock({ ...lock, scroll: event.target.checked })
          }
        />
        lock scroll
      </label>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={!!lock.zoom}
          onChange={(event) =>
            updateLock({ ...lock, zoom: event.target.checked })
          }
        />
        lock zoom
      </label>
      <label style={labelStyle}>
        tolerance
        <input
          type="number"
          min={0}
          step={1}
          value={lock.tolerance ?? 0}
          onChange={(event) =>
            updateLock({
              ...lock,
              tolerance:
                event.target.value === "" ? 0 : Number(event.target.value),
            })
          }
          style={{ width: 56 }}
        />
      </label>
      {OFFSET_SIDES.map((side) => (
        <label key={side} style={labelStyle}>
          {`off ${side}`}
          <input
            type="number"
            min={0}
            step={1}
            value={offset[side] ?? 0}
            onChange={(event) => updateOffset(side, event.target.value)}
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
