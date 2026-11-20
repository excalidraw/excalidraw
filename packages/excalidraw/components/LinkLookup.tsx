import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../i18n";

import { IconButton } from "./IconButton";
import { TextField } from "./TextField";
import { searchIcon } from "./icons";

import "./LinkLookup.scss";

import type { AppProps } from "../types";

/** absolute http(s) URLs only, per the link-lookup contract */
const isPublicUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin !== "null"
    );
  } catch {
    return false;
  }
};

/**
 * "Find a public link" action backed by the host-provided `onLinkLookup`
 * callback. Rendered only when the host configures the callback. The host is
 * called only on explicit submission, receives just the typed query and an
 * abort signal (never scene data), and results are filtered down to absolute
 * http(s) URLs before being offered.
 */
export const LinkLookup = ({
  lookup,
  onPick,
  cancelKey,
}: {
  lookup: NonNullable<AppProps["onLinkLookup"]>;
  onPick: (url: string) => void;
  /** changing this cancels any pending lookup and resets the UI */
  cancelKey?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { title: string; url: string }[] | null
  >(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  // hosts commonly pass an inline closure; keep the latest without making
  // `run` depend on it
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    // bumping the request counter on unmount is intentional: any in-flight
    // response must be treated as stale once the lookup is torn down
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    if (cancelKey === undefined) {
      return;
    }
    requestRef.current++;
    cancel();
    setResults(null);
    setFailed(false);
  }, [cancelKey, cancel]);

  const reset = useCallback(() => {
    requestRef.current++;
    cancel();
    setResults(null);
    setFailed(false);
    setLoading(false);
    setQuery("");
  }, [cancel]);

  const run = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setResults(null);
    setFailed(false);
    setLoading(true);

    lookupRef
      .current(trimmed, { signal: controller.signal })
      .then((response) => {
        if (requestId !== requestRef.current) {
          // stale response — a newer lookup started or the editor closed
          return;
        }
        setResults(
          (Array.isArray(response) ? response : []).filter(
            (result) =>
              result &&
              typeof result.url === "string" &&
              isPublicUrl(result.url),
          ),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== requestRef.current) {
          return;
        }
        console.error("Link lookup failed:", error);
        setFailed(true);
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
  }, [query, cancel]);

  const pick = useCallback(
    (result: { title: string; url: string }) => {
      reset();
      setOpen(false);
      onPick(result.url);
    },
    [reset, onPick],
  );

  return (
    <div className="LinkLookup">
      {!open ? (
        <button
          type="button"
          className="LinkLookup__toggle"
          onClick={() => setOpen(true)}
        >
          {searchIcon}
          {t("elementLink.lookupAction")}
        </button>
      ) : (
        <>
          <div className="LinkLookup__bar">
            <TextField
              value={query}
              onChange={setQuery}
              placeholder={t("elementLink.lookupPlaceholder")}
              className="LinkLookup__field"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // explicit submission; don't trigger the editor's own
                  // Enter-to-save handling
                  event.nativeEvent.stopPropagation();
                  run();
                }
              }}
            />
            <IconButton
              type="button"
              title={t("elementLink.lookupAction")}
              aria-label={t("elementLink.lookupAction")}
              label={t("elementLink.lookupAction")}
              onClick={run}
              className="LinkLookup__submit"
              icon={searchIcon}
            />
          </div>

          {loading ? (
            <div className="LinkLookup__hint">
              {t("elementLink.lookupSearching")}
            </div>
          ) : results === null ? (
            <div className="LinkLookup__hint">
              {t("elementLink.lookupHint")}
            </div>
          ) : results.length === 0 && !failed ? (
            <div className="LinkLookup__hint">
              {t("elementLink.lookupNoResults")}
            </div>
          ) : null}
          {failed && (
            <div className="LinkLookup__hint LinkLookup__hint--error">
              {t("elementLink.lookupFailed")}
            </div>
          )}
          {results !== null && results.length > 0 && (
            <ul className="LinkLookup__results">
              {results.map((result, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="LinkLookup__result"
                    title={result.url}
                    onClick={() => pick(result)}
                  >
                    <span className="LinkLookup__result-title">
                      {result.title}
                    </span>
                    <span className="LinkLookup__result-url">{result.url}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
