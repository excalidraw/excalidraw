import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { getDefaultAppState } from "../appState";
import { ExcalidrawAPIContext } from "../components/App";
import { AppStateObserver } from "../components/AppStateObserver";
import {
  useAppStateValue,
  useOnAppStateChange,
} from "../hooks/useAppStateValue";

import type { AppState, ExcalidrawImperativeAPI } from "../types";

const createAppState = (): AppState => ({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});

const createMockAPI = (initialState: AppState) => {
  let state = initialState;
  const observer = new AppStateObserver(() => state);

  return {
    api: {
      isDestroyed: false,
      getAppState: () => state,
      onStateChange: observer.onStateChange,
    } as Pick<
      ExcalidrawImperativeAPI,
      "isDestroyed" | "getAppState" | "onStateChange"
    > as ExcalidrawImperativeAPI,
    updateAppState: (partial: Partial<AppState>) => {
      const prevState = state;
      state = { ...state, ...partial };
      observer.flush(prevState);
    },
  };
};

describe("app state hooks", () => {
  afterEach(() => {
    cleanup();
  });

  it("useAppStateValue rerenders when the selected value changes", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ValueConsumer = () => {
      const value = useAppStateValue("viewModeEnabled");
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ValueConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it("useOnAppStateChange notifies without rerendering", () => {
    const renderSpy = vi.fn();
    const callback = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ChangeConsumer = () => {
      const value = useOnAppStateChange("viewModeEnabled", callback);
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ChangeConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("undefined");
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ viewModeEnabled: false }),
    );

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ viewModeEnabled: true }),
    );
  });
});
