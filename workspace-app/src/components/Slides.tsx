import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { useMemo, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  applySlideOrder,
  getSlides,
  moveSlide,
  nextSlideRect,
  renameSlide,
} from "../presentation/slides";

export const SlidesPanel = ({
  api,
  elements,
  canEdit,
  onPresent,
  onClose,
}: {
  api: ExcalidrawImperativeAPI | null;
  /** live scene elements (re-render trigger) */
  elements: readonly any[];
  canEdit: boolean;
  onPresent: (from: number) => void;
  onClose: () => void;
}) => {
  const slides = useMemo(() => getSlides(elements), [elements]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const all = () => (api ? api.getSceneElementsIncludingDeleted() : []);
  const write = (next: any[]) => api?.updateScene({ elements: next as any });

  const reorder = (from: number, to: number) => {
    const ids = moveSlide(
      slides.map((s) => s.id),
      from,
      to,
    );
    write(applySlideOrder(all(), ids));
  };

  const goTo = (i: number) => {
    const s = slides[i];
    const el = api?.getSceneElements().find((e) => e.id === s?.id);
    if (api && el) {
      void api.setViewport({
        target: el,
        fit: "contain",
        animation: { duration: 300 },
      } as any);
    }
  };

  const add = () => {
    if (!api) {
      return;
    }
    const a = api.getAppState();
    const center = {
      x: -a.scrollX + a.width / 2 / a.zoom.value,
      y: -a.scrollY + a.height / 2 / a.zoom.value,
    };
    const rect = nextSlideRect(slides, center);
    const created = convertToExcalidrawElements([
      {
        type: "frame",
        children: [],
        name: `Slide ${slides.length + 1}`,
        ...rect,
      } as any,
    ]);
    // pin the new slide to the end explicitly so it can't jump around later
    const order = [...slides.map((s) => s.id), created[0]!.id];
    write(applySlideOrder([...all(), ...created], order));
    setTimeout(() => goTo(slides.length), 50);
  };

  return (
    <aside className="comments-panel" aria-label="Slides">
      <div className="comments-head">
        <strong>Slides</strong>
        <span className="muted small">
          {slides.length} frame{slides.length === 1 ? "" : "s"}
        </span>
        <button
          className="icon-btn"
          style={{ marginLeft: "auto" }}
          onClick={onClose}
          aria-label="Close slides"
        >
          ✕
        </button>
      </div>
      <div className="comments-body">
        <div className="row">
          <button
            className="btn primary small"
            disabled={slides.length === 0}
            onClick={() => onPresent(0)}
          >
            ▶ Present
          </button>
          {canEdit && (
            <button className="btn small" onClick={add}>
              ＋ Add slide
            </button>
          )}
        </div>
        {slides.length === 0 && (
          <p className="muted">
            Slides are frames. Add one here, or draw frames with the frame tool
            (F). They are presented in the order shown.
          </p>
        )}
        <ol className="slides">
          {slides.map((s, i) => (
            <li
              key={s.id}
              draggable={canEdit}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) {
                  reorder(dragFrom, i);
                }
                setDragFrom(null);
              }}
              className={dragFrom === i ? "dragging" : ""}
            >
              <button
                className="slide-no"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
              >
                {i + 1}
              </button>
              {canEdit ? (
                <input
                  aria-label={`Name of slide ${i + 1}`}
                  defaultValue={s.name}
                  key={`${s.id}:${s.name}`}
                  maxLength={80}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== s.name) {
                      write(renameSlide(all(), s.id, name));
                    }
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (e.currentTarget as HTMLInputElement).blur()
                  }
                />
              ) : (
                <span className="ellipsis grow">{s.name}</span>
              )}
              <button
                className="icon-btn"
                title="Present from here"
                aria-label={`Present from slide ${i + 1}`}
                onClick={() => onPresent(i)}
              >
                ▶
              </button>
              {canEdit && (
                <>
                  <button
                    className="icon-btn"
                    disabled={i === 0}
                    aria-label="Move up"
                    onClick={() => reorder(i, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    className="icon-btn"
                    disabled={i === slides.length - 1}
                    aria-label="Move down"
                    onClick={() => reorder(i, i + 1)}
                  >
                    ▼
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
};

export const PresentationBar = ({
  index,
  count,
  title,
  following,
  presenterName,
  onPrev,
  onNext,
  onExit,
}: {
  index: number;
  count: number;
  title: string;
  following: boolean;
  presenterName?: string;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}) => (
  <div
    className="present-bar"
    role="toolbar"
    aria-label="Presentation controls"
  >
    {following ? (
      <span>Following {presenterName ?? "presenter"}</span>
    ) : (
      <button
        className="btn ghost"
        onClick={onPrev}
        disabled={index === 0}
        aria-label="Previous slide"
      >
        ◀
      </button>
    )}
    <span className="present-count" aria-live="polite">
      {index + 1} / {count} · {title}
    </span>
    {!following && (
      <button
        className="btn ghost"
        onClick={onNext}
        disabled={index >= count - 1}
        aria-label="Next slide"
      >
        ▶
      </button>
    )}
    <button
      className="btn ghost"
      onClick={onExit}
      aria-label={following ? "Stop following" : "End presentation"}
    >
      {following ? "Stop following" : "✕ End"}
    </button>
  </div>
);
