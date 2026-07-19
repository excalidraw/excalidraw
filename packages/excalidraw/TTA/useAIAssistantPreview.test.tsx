import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  evictAssistantPreviews,
  useAIAssistantPreview,
} from "./useAIAssistantPreview";

import type { AssistantMessage } from "./types";

const { exportToSvgMock, mockApp } = vi.hoisted(() => ({
  exportToSvgMock: vi.fn(),
  // stable identity — `app` is an effect dependency in the hook (the real
  // useApp returns the context-stable App instance)
  mockApp: { files: {} },
}));

vi.mock("@excalidraw/utils/export", () => ({
  exportToSvg: exportToSvgMock,
}));

vi.mock("../components/App", () => ({
  useApp: () => mockApp,
}));

vi.mock("../hooks/useAppStateValue", () => ({
  useAppStateValue: () => "light",
}));

vi.mock("./insertAISkeletons", () => ({
  convertAISkeletonsToSceneElements: (
    skeletons: ReadonlyArray<{ id?: string }>,
  ) =>
    skeletons.map((skeleton, index) => ({
      id: skeleton.id ?? `element-${index}`,
      type: "rectangle",
      isDeleted: false,
    })),
  fixBoundTextElements: () => {},
}));

const skeleton = (id: string): ExcalidrawElementSkeleton =>
  ({
    type: "rectangle",
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  } as ExcalidrawElementSkeleton);

const completedMessage = (
  id: string,
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton> = [
    skeleton(`${id}-skeleton`),
  ],
): AssistantMessage => ({
  role: "assistant",
  id,
  createdAt: 1,
  skeletons,
  status: { kind: "done", elapsedMs: 10, outcome: "generated" },
});

const streamingMessage = (
  id: string,
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
): AssistantMessage => ({
  role: "assistant",
  id,
  createdAt: 1,
  skeletons,
  status: { kind: "streaming", phase: "generating", startedAt: 1 },
});

type PreviewHookValue = ReturnType<typeof useAIAssistantPreview>;

const Harness = ({
  message,
  enabled,
  onHook,
}: {
  message: AssistantMessage;
  enabled?: boolean;
  onHook: (value: PreviewHookValue) => void;
}) => {
  onHook(
    useAIAssistantPreview(
      message,
      enabled === undefined ? undefined : { enabled },
    ),
  );
  return null;
};

const renderPreview = (message: AssistantMessage, enabled?: boolean) => {
  const hookRef: { current: PreviewHookValue | null } = { current: null };
  const utils = render(
    <Harness
      message={message}
      enabled={enabled}
      onHook={(value) => {
        hookRef.current = value;
      }}
    />,
  );
  return { hookRef, ...utils };
};

/** Mounts a completed message so its preview lands in the module cache. */
const mountUntilDone = async (message: AssistantMessage) => {
  const { hookRef, unmount } = renderPreview(message);
  await waitFor(() => {
    expect(hookRef.current!.status).toBe("done");
  });
  unmount();
};

describe("useAIAssistantPreview", () => {
  beforeEach(() => {
    exportToSvgMock.mockClear();
    exportToSvgMock.mockImplementation(async () =>
      document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("serves a completed message from the cache without re-rendering", async () => {
    const message = completedMessage("cache-hit");
    await mountUntilDone(message);
    expect(exportToSvgMock).toHaveBeenCalledTimes(1);

    // same render key + same skeletons reference → synchronously done from
    // the initializer, no new export
    const { hookRef, unmount } = renderPreview(message);
    expect(hookRef.current!.status).toBe("done");
    expect(hookRef.current!.previewSvg).toMatch(/^data:image\/svg\+xml,/);
    await act(async () => {});
    expect(exportToSvgMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("caps the cache at 32 entries, evicting the least-recently-used one", async () => {
    const messages = Array.from({ length: 32 }, (_, index) =>
      completedMessage(`lru-${index}`),
    );
    for (const message of messages) {
      await mountUntilDone(message);
    }
    expect(exportToSvgMock).toHaveBeenCalledTimes(32);

    // touch lru-0 (cache hit) so lru-1 becomes the least-recently-used entry
    const touched = renderPreview(messages[0]);
    expect(touched.hookRef.current!.status).toBe("done");
    await act(async () => {});
    touched.unmount();
    expect(exportToSvgMock).toHaveBeenCalledTimes(32);

    // 33rd entry exceeds the bound → evicts lru-1, not the freshly-used lru-0
    await mountUntilDone(completedMessage("lru-32"));
    expect(exportToSvgMock).toHaveBeenCalledTimes(33);

    const kept = renderPreview(messages[0]);
    expect(kept.hookRef.current!.status).toBe("done");
    await act(async () => {});
    kept.unmount();
    expect(exportToSvgMock).toHaveBeenCalledTimes(33);

    const evicted = renderPreview(messages[1]);
    expect(evicted.hookRef.current!.status).toBe("loading");
    await waitFor(() => {
      expect(evicted.hookRef.current!.status).toBe("done");
    });
    evicted.unmount();
    expect(exportToSvgMock).toHaveBeenCalledTimes(34);
  });

  it("evictAssistantPreviews drops the given messages' cached previews", async () => {
    const kept = completedMessage("evict-kept");
    const dropped = completedMessage("evict-dropped");
    await mountUntilDone(kept);
    await mountUntilDone(dropped);
    exportToSvgMock.mockClear();

    evictAssistantPreviews(["evict-dropped", "evict-not-cached"]);

    const keptRemount = renderPreview(kept);
    expect(keptRemount.hookRef.current!.status).toBe("done");
    await act(async () => {});
    keptRemount.unmount();
    expect(exportToSvgMock).not.toHaveBeenCalled();

    const droppedRemount = renderPreview(dropped);
    expect(droppedRemount.hookRef.current!.status).toBe("loading");
    await waitFor(() => {
      expect(droppedRemount.hookRef.current!.status).toBe("done");
    });
    droppedRemount.unmount();
    expect(exportToSvgMock).toHaveBeenCalledTimes(1);
  });

  it("enabled: false does no render work and reports idle / cached / unavailable", async () => {
    const message = completedMessage("disabled");

    // uncached → idle, no export
    const idle = renderPreview(message, false);
    expect(idle.hookRef.current!.status).toBe("idle");
    await act(async () => {});
    expect(idle.hookRef.current!.status).toBe("idle");
    expect(exportToSvgMock).not.toHaveBeenCalled();
    idle.unmount();

    // cached → served as done, still no render work
    await mountUntilDone(message);
    exportToSvgMock.mockClear();
    const cached = renderPreview(message, false);
    expect(cached.hookRef.current!.status).toBe("done");
    expect(cached.hookRef.current!.previewSvg).toBeTruthy();
    await act(async () => {});
    expect(exportToSvgMock).not.toHaveBeenCalled();
    cached.unmount();

    // no skeletons → unavailable
    const empty = renderPreview(
      { ...completedMessage("disabled-empty"), skeletons: [] },
      false,
    );
    expect(empty.hookRef.current!.status).toBe("unavailable");
    empty.unmount();
  });

  it("throttles streaming renders with a trailing flush", async () => {
    vi.useFakeTimers();
    const firstChunk = [skeleton("chunk-1")];
    const secondChunk = [skeleton("chunk-1"), skeleton("chunk-2")];

    const hookRef: { current: PreviewHookValue | null } = { current: null };
    const onHook = (value: PreviewHookValue) => {
      hookRef.current = value;
    };
    const { rerender, unmount } = render(
      <Harness
        message={streamingMessage("streaming", firstChunk)}
        onHook={onHook}
      />,
    );

    // leading edge: the first chunk renders immediately
    await act(async () => {});
    expect(exportToSvgMock).toHaveBeenCalledTimes(1);
    expect(hookRef.current!.status).toBe("done");

    // a chunk inside the window parks (previous preview stays visible)
    rerender(
      <Harness
        message={streamingMessage("streaming", secondChunk)}
        onHook={onHook}
      />,
    );
    await act(async () => {});
    expect(exportToSvgMock).toHaveBeenCalledTimes(1);
    expect(hookRef.current!.status).toBe("loading");
    expect(hookRef.current!.previewSvg).toBeTruthy();

    // trailing edge flushes the parked chunk
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {});
    expect(exportToSvgMock).toHaveBeenCalledTimes(2);
    expect(hookRef.current!.status).toBe("done");
    unmount();
  });
});
