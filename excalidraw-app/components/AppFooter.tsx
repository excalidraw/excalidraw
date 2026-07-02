import { Footer } from "@excalidraw/excalidraw/index";
import { getSelectedElements } from "@excalidraw/element";
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
type ScrollToFit = NonNullable<ScrollToArgs["fit"]>;
type LockOptions = NonNullable<ScrollToArgs["lock"]>;
type ScrollToTarget = ScrollToArgs["target"];

const OFFSET_SIDES = ["top", "right", "bottom", "left"] as const;

const ScrollConstraintsDebugFooter = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [locked, setLocked] = useState(false);
  const [fit, setFit] = useState<ScrollToFit>("scale-down");
  const [lock, setLock] = useState<LockOptions>({
    scroll: true,
    zoom: false,
    tolerance: 0,
  });
  const [offsets, setOffsets] = useState<Offsets>({
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

  const getCurrentLockTarget = useCallback((): ScrollToTarget | null => {
    if (!excalidrawAPI) {
      return null;
    }

    const selectedElements = getSelectedElementsForLock();
    return selectedElements.length
      ? selectedElements
      : excalidrawAPI.getSceneElements();
  }, [excalidrawAPI, getSelectedElementsForLock]);

  const applyLockToCurrentTarget = useCallback(
    (
      nextLock: LockOptions,
      nextOffsets: Offsets,
      fit: ScrollToFit,
      animation: ScrollToArgs["animation"] = false,
    ) => {
      if (!excalidrawAPI) {
        return;
      }
      const target = getCurrentLockTarget();
      if (!target) {
        return;
      }
      excalidrawAPI.scrollTo({
        target,
        fit,
        animation,
        lock: nextLock,
        offsets: nextOffsets,
      });
      setLocked(true);
    },
    [excalidrawAPI, getCurrentLockTarget],
  );

  const updateLocked = useCallback(
    (nextLocked: boolean) => {
      if (!excalidrawAPI) {
        return;
      }

      if (nextLocked) {
        applyLockToCurrentTarget(lock, offsets, fit);
      } else {
        excalidrawAPI.scrollTo(null);
        setLocked(false);
      }
    },
    [applyLockToCurrentTarget, fit, excalidrawAPI, lock, offsets],
  );

  const toggleLock = useCallback(() => {
    updateLocked(!locked);
  }, [locked, updateLocked]);

  const scrollToSelectionWithLock = useCallback(() => {
    const selectedElements = getCurrentLockTarget();
    if (!excalidrawAPI || !selectedElements) {
      return;
    }
    excalidrawAPI.scrollTo({
      target: selectedElements,
      fit,
      animation: true,
      lock,
      offsets,
    });
    setLocked(true);
  }, [excalidrawAPI, fit, lock, offsets, getCurrentLockTarget]);

  const updateLock = useCallback(
    (nextLock: LockOptions) => {
      setLock(nextLock);
      if (locked) {
        applyLockToCurrentTarget(nextLock, offsets, fit);
      }
    },
    [applyLockToCurrentTarget, fit, locked, offsets],
  );

  const updateBehavior = useCallback(
    (nextBehavior: ScrollToFit) => {
      setFit(nextBehavior);
      if (locked) {
        applyLockToCurrentTarget(lock, offsets, nextBehavior);
      }
    },
    [applyLockToCurrentTarget, lock, locked, offsets],
  );

  const updateOffset = useCallback(
    (side: typeof OFFSET_SIDES[number], value: string) => {
      const nextOffsets = {
        ...offsets,
        [side]: value === "" ? 0 : Number(value),
      };
      setOffsets(nextOffsets);
      if (locked) {
        applyLockToCurrentTarget(lock, nextOffsets, fit);
      }
    },
    [applyLockToCurrentTarget, fit, offsets, lock, locked],
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
        fit
        <select
          value={fit}
          onChange={(event) =>
            updateBehavior(event.target.value as ScrollToFit)
          }
        >
          <option value="scale-down">scale-down</option>
          <option value="contain">contain</option>
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
            value={offsets[side] ?? 0}
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
