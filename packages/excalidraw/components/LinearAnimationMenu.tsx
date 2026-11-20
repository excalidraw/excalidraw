import React, { useState } from "react";

import {
  DEFAULT_ANIMATION_SIZE,
  MAX_ANIMATION_COUNT,
  restoreLinearElementAnimation,
} from "@excalidraw/element/linearElementAnimation";

import { isLinearElement } from "@excalidraw/element";

import type { LinearElementAnimation } from "@excalidraw/element/types";

import { actionChangeLinearAnimation } from "../actions/actionLinearAnimation";
import { t } from "../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "./App";

import type { ActionManager } from "../actions/manager";

export const LinearAnimationMenu = ({
  actionManager,
  onBack,
}: {
  actionManager: ActionManager;
  onBack: () => void;
}) => {
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements();
  const selected = elements.filter(
    (element) =>
      appState.selectedElementIds[element.id] && isLinearElement(element),
  );
  const first = selected[0];
  const initialAnimation =
    first && isLinearElement(first)
      ? restoreLinearElementAnimation(first.animation)
      : null;
  const [animation, setAnimation] = useState(initialAnimation);
  const [edited, setEdited] = useState(false);
  const settings = animation ?? {
    type: "dot",
    count: 1,
    speed: 0.5,
    size: DEFAULT_ANIMATION_SIZE,
    direction: "forward",
  };
  const mixed =
    !edited &&
    selected.some(
      (element) =>
        isLinearElement(element) &&
        JSON.stringify(restoreLinearElementAnimation(element.animation)) !==
          JSON.stringify(initialAnimation ?? null),
    );
  const update = (value: LinearElementAnimation | null) => {
    setEdited(true);
    setAnimation(value);
  };
  return (
    <div
      className="context-menu animation-menu"
      onKeyDown={(event) => {
        if (
          event.key === "Escape" ||
          (event.key === "ArrowLeft" && event.target === event.currentTarget)
        ) {
          event.stopPropagation();
          onBack();
        }
      }}
    >
      <button
        autoFocus
        type="button"
        className="context-menu-item"
        onClick={onBack}
      >
        ‹ {t("labels.animation.title")}
      </button>
      {mixed && <p role="status">{t("labels.animation.mixed")}</p>}
      <label>
        {t("labels.animation.type")}
        <select
          aria-label={t("labels.animation.type")}
          value={mixed ? "mixed" : animation?.type ?? "none"}
          onChange={(event) =>
            update(
              event.target.value === "none"
                ? null
                : {
                    ...settings,
                    type: event.target.value as LinearElementAnimation["type"],
                  },
            )
          }
        >
          {mixed && (
            <option value="mixed" disabled>
              {t("labels.animation.mixed")}
            </option>
          )}
          <option value="none">{t("labels.animation.none")}</option>
          <option value="dot">{t("labels.animation.dot")}</option>
          <option value="gap">{t("labels.animation.gap")}</option>
          <option value="dashes">{t("labels.animation.dashes")}</option>
          <option value="pulse">{t("labels.animation.pulse")}</option>
        </select>
      </label>
      {(settings.type === "dot" || settings.type === "gap") && (
        <label>
          {t("labels.animation.count")}
          <input
            type="range"
            aria-label={t("labels.animation.count")}
            min={1}
            max={MAX_ANIMATION_COUNT}
            step={1}
            disabled={!animation && !mixed}
            value={settings.count}
            onChange={(event) =>
              update({ ...settings, count: Number(event.target.value) })
            }
          />
          <output>{settings.count}</output>
        </label>
      )}
      <label>
        {t("labels.animation.speed")}
        <input
          type="range"
          aria-label={t("labels.animation.speed")}
          min={0}
          max={1}
          step={0.01}
          disabled={!animation && !mixed}
          value={settings.speed}
          onChange={(event) =>
            update({ ...settings, speed: Number(event.target.value) })
          }
        />
        <output>{settings.speed.toFixed(2)}</output>
      </label>
      <label>
        {t("labels.animation.size")}
        <input
          type="range"
          aria-label={t("labels.animation.size")}
          min={1}
          max={100}
          step={1}
          disabled={!animation && !mixed}
          value={settings.size}
          onChange={(event) =>
            update({ ...settings, size: Number(event.target.value) })
          }
        />
        <input
          type="number"
          aria-label={t("labels.animation.sizeValue")}
          min={1}
          max={100}
          step={1}
          disabled={!animation && !mixed}
          value={settings.size}
          onChange={(event) => {
            const size = event.target.valueAsNumber;
            if (Number.isFinite(size) && size >= 1 && size <= 100) {
              update({ ...settings, size });
            }
          }}
        />
      </label>
      <label>
        {t("labels.animation.direction")}
        <select
          aria-label={t("labels.animation.direction")}
          disabled={(!animation && !mixed) || settings.type === "pulse"}
          value={settings.direction}
          onChange={(event) =>
            update({
              ...settings,
              direction: event.target
                .value as LinearElementAnimation["direction"],
            })
          }
        >
          <option value="forward">{t("labels.animation.forward")}</option>
          <option value="reverse">{t("labels.animation.reverse")}</option>
        </select>
      </label>
      <button
        type="button"
        className="context-menu-item"
        disabled={mixed}
        onClick={() =>
          actionManager.executeAction(
            actionChangeLinearAnimation,
            "contextMenu",
            animation ?? null,
          )
        }
      >
        {t("labels.animation.apply")}
      </button>
    </div>
  );
};
