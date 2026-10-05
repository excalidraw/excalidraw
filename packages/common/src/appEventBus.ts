import type { UnsubscribeCallback } from "@excalidraw/excalidraw/types";

import { Emitter } from "./emitter";
import { isProdEnv } from "./utils";

export type AppEventPayloadMap = Record<string, unknown[]>;

export type AppEventBehavior = {
  cardinality: "once" | "many";
  replay: "none" | "last";
};

export type AppEventBehaviorMap<Events extends AppEventPayloadMap> = {
  [K in keyof Events]: AppEventBehavior;
};

type AwaitableAppEventKeys<
  Events extends AppEventPayloadMap,
  Behavior extends AppEventBehaviorMap<Events>,
> = {
  [K in keyof Events]: Behavior[K]["cardinality"] extends "once"
    ? Behavior[K]["replay"] extends "last"
      ? K
      : never
    : never;
}[keyof Events];

type AppEventPromiseValue<Args extends any[]> = Args extends [infer Only]
  ? Only
  : Args;

export class AppEventBus<
  Events extends AppEventPayloadMap,
  Behavior extends AppEventBehaviorMap<Events>,
> {
  private readonly emitters = new Map<keyof Events, Emitter<any>>();
  private readonly lastPayload = new Map<keyof Events, any[]>();
  private readonly emittedOnce = new Set<keyof Events>();

  constructor(private readonly behavior: Behavior) {}

  private getEmitter<K extends keyof Events>(name: K): Emitter<Events[K]> {
    let emitter = this.emitters.get(name);
    if (!emitter) {
      emitter = new Emitter<any>();
      this.emitters.set(name, emitter);
    }
    return emitter as Emitter<Events[K]>;
  }

  private toPromiseValue<Args extends any[]>(
    args: Args,
  ): AppEventPromiseValue<Args> {
    return (args.length === 1 ? args[0] : args) as AppEventPromiseValue<Args>;
  }

  public on<K extends keyof Events>(
    name: K,
    callback: (...args: Events[K]) => void,
  ): UnsubscribeCallback;
  public on<K extends AwaitableAppEventKeys<Events, Behavior>>(
    name: K,
  ): Promise<AppEventPromiseValue<Events[K]>>;
  public on<K extends keyof Events>(
    name: K,
    callback?: (...args: Events[K]) => void,
  ): UnsubscribeCallback | Promise<AppEventPromiseValue<Events[K]>> {
    const eventBehavior = this.behavior[name];
    const cachedPayload = this.lastPayload.get(name) as Events[K] | undefined;

    if (callback) {
      if (eventBehavior.replay === "last" && cachedPayload) {
        queueMicrotask(() => callback(...cachedPayload));

        if (eventBehavior.cardinality === "once") {
          return () => {};
        }
      }

      return this.getEmitter(name).on(callback);
    }

    if (
      eventBehavior.cardinality !== "once" ||
      eventBehavior.replay !== "last"
    ) {
      throw new Error(`Event "${String(name)}" requires a callback`);
    }

    if (cachedPayload) {
      return Promise.resolve(this.toPromiseValue(cachedPayload));
    }

    return new Promise<AppEventPromiseValue<Events[K]>>((resolve) => {
      this.getEmitter(name).once((...args: Events[K]) => {
        resolve(this.toPromiseValue(args));
      });
    });
  }

  public emit<K extends keyof Events>(name: K, ...args: Events[K]) {
    const eventBehavior = this.behavior[name];

    if (!isProdEnv()) {
      if (eventBehavior.cardinality === "once") {
        if (this.emittedOnce.has(name)) {
          throw new Error(`Event "${String(name)}" can only be emitted once`);
        }
        this.emittedOnce.add(name);
      }
    }

    if (eventBehavior.replay === "last") {
      this.lastPayload.set(name, args);
    }

    try {
      this.getEmitter(name).trigger(...args);
    } finally {
      if (eventBehavior.cardinality === "once") {
        this.getEmitter(name).clear();
      }
    }
  }

  public clear() {
    this.lastPayload.clear();
    this.emittedOnce.clear();

    for (const emitter of this.emitters.values()) {
      emitter.clear();
    }

    this.emitters.clear();
  }
}
