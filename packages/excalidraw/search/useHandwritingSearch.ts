import { useEffect, useMemo, useRef, useState } from "react";

import { useStable } from "../hooks/useStable";

import { getHandwritingLines, rasterizeHandwriting } from "./handwriting";
import { HandwritingRecognizer } from "./handwritingRecognizer";

import type { HandwritingResult } from "./handwriting";
import type { AppClassProperties } from "../types";

// Scene-scoped, memory-only: recognized text never enters saved/collaborated data.
const caches = new WeakMap<AppClassProperties["scene"], Map<string, string>>();

export const useHandwritingSearch = (
  app: AppClassProperties,
  enabled: boolean,
) => {
  const sceneNonce = app.scene.getSceneNonce();
  const lines = useMemo(
    () =>
      enabled ? getHandwritingLines(app.scene.getNonDeletedElements()) : [],
    // Scene mutations can update elements in place without replacing the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, enabled, sceneNonce],
  );
  const signature = JSON.stringify(lines.map((line) => line.key));
  const stable = useStable({ lines });
  const recognizer = useRef<HandwritingRecognizer | null>(null);
  const [state, setState] = useState<{
    signature: string;
    results: HandwritingResult[];
    status: "idle" | "loading" | "error";
  }>({ signature: "", results: [], status: "idle" });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const instance = new HandwritingRecognizer(app);
    recognizer.current = instance;
    return () => {
      instance.dispose();
      recognizer.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const isCancelled = () => cancelled;
    const lines = stable.lines;
    let cache = caches.get(app.scene);
    if (!cache) {
      cache = new Map();
      caches.set(app.scene, cache);
    }
    const currentKeys = new Set(lines.map((line) => line.key));
    for (const key of cache.keys()) {
      if (!currentKeys.has(key)) {
        cache.delete(key);
      }
    }
    const results = () =>
      lines.flatMap((line) => {
        const text = cache.get(line.key);
        return text ? [{ ...line, text }] : [];
      });
    setState({
      signature,
      results: results(),
      status: lines.some((line) => !cache.has(line.key)) ? "loading" : "idle",
    });
    const timer = app.ownerWindow.setTimeout(async () => {
      try {
        for (const line of lines) {
          if (cancelled) {
            return;
          }
          if (!cache.has(line.key)) {
            const text = await recognizer.current!.recognize(
              rasterizeHandwriting(line, app.ownerDocument),
              isCancelled,
            );
            if (cancelled) {
              return;
            }
            cache.set(line.key, text);
            setState({ signature, results: results(), status: "loading" });
          }
        }
        if (!cancelled) {
          setState({ signature, results: results(), status: "idle" });
        }
      } catch {
        if (!cancelled) {
          setState({ signature, results: results(), status: "error" });
        }
      }
    }, 750);
    return () => {
      cancelled = true;
      app.ownerWindow.clearTimeout(timer);
    };
  }, [app, enabled, signature, stable]);

  return {
    results:
      enabled && state.signature === signature ? state.results : EMPTY_RESULTS,
    status: enabled ? state.status : "idle",
  };
};

const EMPTY_RESULTS: HandwritingResult[] = [];
