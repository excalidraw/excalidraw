import { useState } from "react";

import { DEFAULT_FONT_SIZE } from "@excalidraw/common";

import { t } from "../i18n";

export const FontSizeInput = ({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (size: number) => void;
}) => {
  const [observed, setObserved] = useState(value);
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  if (observed !== value) {
    setObserved(value);
    setDraft(value === null ? "" : String(value));
  }

  const commit = (text: string) => {
    const next = Number(text);
    if (!text.trim() || !Number.isFinite(next) || next < 1 || next > 1000) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    setDraft(String(next));
    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <input
      className="font-size-input"
      type="number"
      aria-label={t("labels.fontSize")}
      min={1}
      max={1000}
      step="any"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const parsed = Number(draft);
          const current =
            draft.trim() && Number.isFinite(parsed)
              ? parsed
              : value ?? DEFAULT_FONT_SIZE;
          commit(
            String(
              Math.max(
                1,
                Math.min(1000, current + (event.key === "ArrowUp" ? 1 : -1)),
              ),
            ),
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.value = value === null ? "" : String(value);
          setDraft(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
};
