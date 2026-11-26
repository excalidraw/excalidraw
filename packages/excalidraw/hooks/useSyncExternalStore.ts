import React, { useEffect, useReducer, useRef } from "react";

/**
 * For React 17, which has none. Subscribes in an effect, and reads again
 * once subscribed: a change landing between the render and the subscription
 * would otherwise go unnoticed until the next one.
 */
export const useSyncExternalStorePolyfill = <T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
): T => {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const snapshot = getSnapshot();
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const renderedSnapshotRef = useRef(snapshot);
  renderedSnapshotRef.current = snapshot;

  useEffect(() => {
    const onStoreChange = () => {
      if (getSnapshotRef.current() !== renderedSnapshotRef.current) {
        rerender();
      }
    };
    const unsubscribe = subscribe(onStoreChange);
    onStoreChange();
    return unsubscribe;
  }, [subscribe]);

  return snapshot;
};

export const useSyncExternalStore: typeof useSyncExternalStorePolyfill =
  React.useSyncExternalStore || useSyncExternalStorePolyfill;
