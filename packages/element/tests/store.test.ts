import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { arrayToMap } from "@excalidraw/common";

import type App from "@excalidraw/excalidraw/components/App";

import type { ObservedAppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import {
  CaptureUpdateAction,
  Store,
  StoreSnapshot,
  newElementWith,
} from "../src";

const getScheduledMicroActionCount = (store: Store) =>
  (
    store as unknown as {
      scheduledMicroActions: Array<() => void>;
    }
  ).scheduledMicroActions.length;

const flushMicroActions = (store: Store) => {
  (
    store as unknown as {
      flushMicroActions: () => void;
    }
  ).flushMicroActions();
};

const toSceneElementsMap = (
  elements: readonly ExcalidrawElement[],
): SceneElementsMap => arrayToMap(elements) as SceneElementsMap;

const createStoreHarness = (elements: SceneElementsMap) => {
  const appState: ObservedAppState = StoreSnapshot.empty().appState;
  const app = {
    scene: {
      getElementsMapIncludingDeleted: () => elements,
    },
    state: appState,
  } as unknown as App;

  const store = new Store(app);
  store.snapshot = StoreSnapshot.create(elements, appState);

  return { store, appState };
};

describe("Store synthetic increment isolation", () => {
  it("keeps pending immediate micro actions queued across synthetic commit", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "store-isolated-immediate",
      x: 0,
      y: 0,
    });
    const baselineElements = toSceneElementsMap([element]);
    const { store } = createStoreHarness(baselineElements);

    const incrementTypes: Array<"durable" | "ephemeral"> = [];
    const detach = store.onStoreIncrementEmitter.on((increment) => {
      incrementTypes.push(increment.type);
    });

    store.scheduleMicroAction({
      action: CaptureUpdateAction.IMMEDIATELY,
      elements: [newElementWith(element, { y: 240 })],
      appState: undefined,
    });

    expect(getScheduledMicroActionCount(store)).toBe(1);

    const committed = store.commitSyntheticIncrement({
      logicalBefore: {
        elements: baselineElements,
      },
      logicalAfter: {
        elements: toSceneElementsMap([newElementWith(element, { x: 120 })]),
      },
    });

    expect(committed).toBe(true);
    expect(incrementTypes).toEqual(["durable"]);
    expect(getScheduledMicroActionCount(store)).toBe(1);

    flushMicroActions(store);

    expect(incrementTypes).toEqual(["durable", "durable"]);
    expect(getScheduledMicroActionCount(store)).toBe(0);
    detach();
  });

  it("keeps pending eventually micro actions queued across synthetic commit", () => {
    const element = API.createElement({
      type: "rectangle",
      id: "store-isolated-eventually",
      x: 0,
      y: 0,
    });
    const baselineElements = toSceneElementsMap([element]);
    const { store } = createStoreHarness(baselineElements);

    const incrementTypes: Array<"durable" | "ephemeral"> = [];
    const detach = store.onStoreIncrementEmitter.on((increment) => {
      incrementTypes.push(increment.type);
    });

    store.scheduleMicroAction({
      action: CaptureUpdateAction.EVENTUALLY,
      elements: [newElementWith(element, { y: 240 })],
      appState: undefined,
    });

    expect(getScheduledMicroActionCount(store)).toBe(1);

    const committed = store.commitSyntheticIncrement({
      logicalBefore: {
        elements: baselineElements,
      },
      logicalAfter: {
        elements: toSceneElementsMap([newElementWith(element, { x: 120 })]),
      },
    });

    expect(committed).toBe(true);
    expect(incrementTypes).toEqual(["durable"]);
    expect(getScheduledMicroActionCount(store)).toBe(1);

    flushMicroActions(store);

    expect(incrementTypes).toEqual(["durable", "ephemeral"]);
    expect(getScheduledMicroActionCount(store)).toBe(0);
    detach();
  });
});
