import React from "react";
import { vi } from "vitest";

import { resolvablePromise } from "@excalidraw/common";

import { Excalidraw, CaptureUpdateAction } from "../../index";
import { API } from "../helpers/api";
import { Pointer } from "../helpers/ui";
import { render, unmountComponent } from "../test-utils";

import type { ExcalidrawImperativeAPI } from "../../types";

describe("event callbacks", () => {
  const h = window.h;

  let excalidrawAPI: ExcalidrawImperativeAPI;

  const mouse = new Pointer("mouse");

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw
        onExcalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  it("should resolve editor:mount/editor:initialize when subscribed before mount", async () => {
    unmountComponent();

    const lifecyclePromise = resolvablePromise<{
      api: ExcalidrawImperativeAPI;
      mount: Promise<{
        excalidrawAPI: ExcalidrawImperativeAPI;
        container: HTMLDivElement | null;
      }>;
      initialize: Promise<ExcalidrawImperativeAPI>;
    }>();

    await render(
      <Excalidraw
        onExcalidrawAPI={(api) =>
          lifecyclePromise.resolve({
            api: api as ExcalidrawImperativeAPI,
            mount: api.onEvent("editor:mount"),
            initialize: api.onEvent("editor:initialize"),
          })
        }
      />,
    );

    const { api, mount, initialize } = await lifecyclePromise;
    await expect(mount).resolves.toEqual({
      excalidrawAPI: api,
      container: expect.any(HTMLDivElement),
    });
    await expect(initialize).resolves.toBe(api);
  });

  it("should replay editor:mount/editor:initialize to late subscribers", async () => {
    const onMount = vi.fn();
    const onInitialize = vi.fn();

    excalidrawAPI.onEvent("editor:mount", onMount);
    excalidrawAPI.onEvent("editor:initialize", onInitialize);

    await Promise.resolve();

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onMount).toHaveBeenCalledWith({
      excalidrawAPI,
      container: expect.any(HTMLDivElement),
    });
    expect(onInitialize).toHaveBeenCalledTimes(1);
    expect(onInitialize).toHaveBeenCalledWith(excalidrawAPI);

    await expect(excalidrawAPI.onEvent("editor:mount")).resolves.toEqual({
      excalidrawAPI,
      container: expect.any(HTMLDivElement),
    });
    await expect(excalidrawAPI.onEvent("editor:initialize")).resolves.toBe(
      excalidrawAPI,
    );
  });

  it("should call onMount before onInitialize props", async () => {
    unmountComponent();

    const calls: string[] = [];

    await render(
      <Excalidraw
        onMount={({ excalidrawAPI, container }) => {
          expect(excalidrawAPI).toBeDefined();
          expect(container).toBeInstanceOf(HTMLDivElement);
          calls.push("mount");
        }}
        onInitialize={() => {
          calls.push("initialize");
        }}
      />,
    );

    expect(calls).toEqual(["mount", "initialize"]);
  });

  it("should trigger onChange on render", async () => {
    const onChange = vi.fn();

    const origBackgroundColor = h.state.viewBackgroundColor;
    excalidrawAPI.onChange(onChange);
    API.updateScene({
      appState: { viewBackgroundColor: "red" },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(onChange).toHaveBeenCalledWith(
      // elements
      [],
      // appState
      expect.objectContaining({
        viewBackgroundColor: "red",
      }),
      // files
      {},
    );
    expect(onChange.mock?.lastCall?.[1].viewBackgroundColor).not.toBe(
      origBackgroundColor,
    );
  });

  it("should trigger onPointerDown/onPointerUp on canvas pointerDown/pointerUp", async () => {
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();

    excalidrawAPI.onPointerDown(onPointerDown);
    excalidrawAPI.onPointerUp(onPointerUp);

    mouse.downAt(100);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).not.toHaveBeenCalled();
    mouse.up();
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });
});
