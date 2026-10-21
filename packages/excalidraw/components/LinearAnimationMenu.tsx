import React, { useState } from "react";

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
    first && isLinearElement(first) ? first.animation : null;
  const [animation, setAnimation] = useState(initialAnimation);
  const [edited, setEdited] = useState(false);
  const settings = animation ?? {
    type: "dots",
    speed: 1,
    direction: "forward",
  };
  const mixed =
    !edited &&
    selected.some(
      (element) =>
        isLinearElement(element) &&
        JSON.stringify(element.animation ?? null) !==
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
        if (event.key === "Escape" || event.key === "ArrowLeft") {
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
          <option value="dots">{t("labels.animation.dots")}</option>
          <option value="dashes">{t("labels.animation.dashes")}</option>
          <option value="pulse">{t("labels.animation.pulse")}</option>
        </select>
      </label>
      <label>
        {t("labels.animation.speed")}
        <select
          aria-label={t("labels.animation.speed")}
          disabled={!animation && !mixed}
          value={settings.speed}
          onChange={(event) =>
            update({
              ...settings,
              speed: Number(
                event.target.value,
              ) as LinearElementAnimation["speed"],
            })
          }
        >
          <option value={0.5}>{t("labels.animation.slow")}</option>
          <option value={1}>{t("labels.animation.normal")}</option>
          <option value={2}>{t("labels.animation.fast")}</option>
        </select>
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
