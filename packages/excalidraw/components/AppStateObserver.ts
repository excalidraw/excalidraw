import type { AppState, UnsubscribeCallback } from "../types";

type StateChangeSelector =
  | keyof AppState
  | (keyof AppState)[]
  | ((appState: AppState) => unknown);

type StateChangePredicateOptions = {
  predicate: (appState: AppState) => boolean;
  callback?: (appState: AppState) => void;
  once?: boolean;
};

type StateChangeArg = StateChangeSelector | StateChangePredicateOptions;

type StateChangeListener = {
  predicate: (appState: AppState, prevState: AppState) => boolean;
  getValue: (appState: AppState) => unknown;
  callback: (value: any, appState: AppState) => void;
  once: boolean;
};

type NormalizedStateChange = {
  predicate: StateChangeListener["predicate"];
  getValue: StateChangeListener["getValue"];
  callback?: StateChangeListener["callback"];
  once: boolean;
  matchesImmediately: boolean;
};

export type OnStateChange = {
  <K extends keyof AppState>(
    prop: K,
    callback: (value: AppState[K], appState: AppState) => void,
    opts?: { once: boolean },
  ): UnsubscribeCallback;
  <K extends keyof AppState>(prop: K): Promise<AppState[K]>;
  (
    prop: (keyof AppState)[],
    callback: (appState: AppState, appState2: AppState) => void,
    opts?: { once: boolean },
  ): UnsubscribeCallback;
  (prop: (keyof AppState)[]): Promise<AppState>;
  <T>(
    prop: (appState: AppState) => T,
    callback: (value: T, appState: AppState) => void,
    opts?: { once: boolean },
  ): UnsubscribeCallback;
  <T>(prop: (appState: AppState) => T): Promise<T>;
  (opts: {
    predicate: (appState: AppState) => boolean;
    callback: (appState: AppState) => void;
    once?: boolean;
  }): UnsubscribeCallback;
  (opts: { predicate: (appState: AppState) => boolean }): Promise<AppState>;
  (
    selector: StateChangeSelector,
    callback: (value: any, appState: AppState) => void,
  ): any;
};

export class AppStateObserver {
  private listeners: StateChangeListener[] = [];

  constructor(private readonly getState: () => AppState) {}

  private isStateChangePredicateOptions(
    propOrOpts: StateChangeArg,
  ): propOrOpts is StateChangePredicateOptions {
    return (
      typeof propOrOpts === "object" &&
      !Array.isArray(propOrOpts) &&
      "predicate" in propOrOpts
    );
  }

  private subscribe(listener: StateChangeListener): UnsubscribeCallback {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(
        (existingListener) => existingListener !== listener,
      );
    };
  }

  private normalize(
    propOrOpts: StateChangeArg,
    callback?: (value: any, appState: AppState) => void,
    opts?: { once: boolean },
  ): NormalizedStateChange {
    let predicate: StateChangeListener["predicate"];
    let getValue: StateChangeListener["getValue"];
    let normalizedCallback = callback;
    let once = opts?.once ?? false;
    let matchesImmediately = false;

    if (this.isStateChangePredicateOptions(propOrOpts)) {
      const {
        predicate: predicateFn,
        callback: callbackFromOpts,
        once: onceFromOpts,
      } = propOrOpts;

      predicate = predicateFn;
      getValue = (appState: AppState) => appState;
      normalizedCallback = callbackFromOpts
        ? (_value: AppState, appState: AppState) => callbackFromOpts(appState)
        : undefined;
      once = onceFromOpts ?? false;
      matchesImmediately = predicateFn(this.getState());
    } else if (typeof propOrOpts === "function") {
      const selector = propOrOpts;
      predicate = (appState: AppState, prevState: AppState) =>
        selector(appState) !== selector(prevState);
      getValue = (appState: AppState) => selector(appState);
    } else if (Array.isArray(propOrOpts)) {
      const keys = propOrOpts;
      predicate = (appState: AppState, prevState: AppState) =>
        keys.some((key) => appState[key] !== prevState[key]);
      getValue = (appState: AppState) => appState;
    } else {
      const key = propOrOpts;
      predicate = (appState: AppState, prevState: AppState) =>
        appState[key] !== prevState[key];
      getValue = (appState: AppState) => appState[key];
    }

    return {
      predicate,
      getValue,
      callback: normalizedCallback,
      once,
      matchesImmediately,
    };
  }

  public onStateChange: OnStateChange = ((
    propOrOpts: StateChangeArg,
    callback?: any,
    opts?: { once: boolean },
  ) => {
    const {
      predicate,
      getValue,
      callback: stateChangeCallback,
      once,
      matchesImmediately,
    } = this.normalize(propOrOpts, callback, opts);

    if (stateChangeCallback) {
      if (matchesImmediately) {
        queueMicrotask(() => {
          const state = this.getState();
          stateChangeCallback(getValue(state), state);
        });
        if (once) {
          return () => {};
        }
      }

      return this.subscribe({
        predicate,
        getValue,
        callback: stateChangeCallback,
        once,
      });
    }

    if (matchesImmediately) {
      return Promise.resolve(getValue(this.getState()));
    }

    return new Promise<any>((resolve) => {
      this.subscribe({
        predicate,
        getValue,
        callback: (value) => resolve(value),
        once: true,
      });
    });
  }) as OnStateChange;

  public flush(prevState: AppState) {
    if (!this.listeners.length) {
      return;
    }

    const state = this.getState();
    const listenersToKeep: StateChangeListener[] = [];

    for (const listener of this.listeners) {
      if (listener.predicate(state, prevState)) {
        listener.callback(listener.getValue(state), state);
        if (!listener.once) {
          listenersToKeep.push(listener);
        }
      } else {
        listenersToKeep.push(listener);
      }
    }

    this.listeners = listenersToKeep;
  }

  public clear() {
    this.listeners = [];
  }
}
