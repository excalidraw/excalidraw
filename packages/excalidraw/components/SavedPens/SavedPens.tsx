import clsx from "clsx";
import { ContextMenu } from "radix-ui";

import { applyDarkModeFilter, SAVED_PENS_MAX, THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { useExcalidrawContainer } from "../App";
import { PlusIcon } from "../icons";

import "../TopPicksDnD/TopPicksDnD.scss";

import "./SavedPens.scss";

import type { SavedPen } from "../../types";

export const isSamePen = (a: SavedPen, b: SavedPen) =>
  a.strokeColor === b.strokeColor &&
  a.strokeWidthKey === b.strokeWidthKey &&
  a.opacity === b.opacity &&
  a.strokeVariability === b.strokeVariability;

const getPenTitle = (pen: SavedPen) =>
  [
    pen.strokeColor,
    t(`labels.${pen.strokeWidthKey}`),
    `${pen.opacity}%`,
    t(`labels.pressure_${pen.strokeVariability}`),
  ].join(" · ");

const SavedPenButton = ({
  pen,
  index,
  theme,
  isActive,
  onApply,
  onRemove,
}: {
  pen: SavedPen;
  index: number;
  theme: Theme;
  isActive: boolean;
  onApply: (pen: SavedPen) => void;
  onRemove: (index: number) => void;
}) => {
  const { container } = useExcalidrawContainer();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          type="button"
          className={clsx(
            "saved-pens__pen",
            `saved-pens__pen--${pen.strokeWidthKey}`,
            { active: isActive },
          )}
          aria-pressed={isActive}
          title={getPenTitle(pen)}
          onClick={() => onApply(pen)}
          data-testid={`saved-pen-${index}`}
        >
          <span
            className="saved-pens__dot"
            style={{
              backgroundColor: applyDarkModeFilter(
                pen.strokeColor,
                theme === THEME.DARK,
              ),
              opacity: pen.opacity / 100,
            }}
          />
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Content
          className="top-picks-dnd__context-menu"
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
        >
          <ContextMenu.Item
            className="top-picks-dnd__context-menu-item"
            onSelect={() => onRemove(index)}
          >
            {t("labels.removeSavedPen")}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

/**
 * Saved freedraw styles. Clicking a pen applies it, right-clicking offers to
 * remove it, and the plus button saves the current style as a new pen.
 */
export const SavedPens = ({
  pens,
  currentPen,
  theme,
  onSave,
  onApply,
  onRemove,
}: {
  pens: readonly SavedPen[];
  currentPen: SavedPen;
  theme: Theme;
  onSave: () => void;
  onApply: (pen: SavedPen) => void;
  onRemove: (index: number) => void;
}) => {
  const isCurrentPenSaved = pens.some((pen) => isSamePen(pen, currentPen));

  return (
    <fieldset className="saved-pens">
      <legend>{t("labels.savedPens")}</legend>
      <div className="buttonList">
        {pens.map((pen, index) => (
          <SavedPenButton
            key={`${index}-${pen.strokeColor}-${pen.strokeWidthKey}-${pen.opacity}-${pen.strokeVariability}`}
            pen={pen}
            index={index}
            theme={theme}
            isActive={isSamePen(pen, currentPen)}
            onApply={onApply}
            onRemove={onRemove}
          />
        ))}
        <button
          type="button"
          className="saved-pens__save"
          title={t("labels.savePen")}
          aria-label={t("labels.savePen")}
          disabled={isCurrentPenSaved || pens.length >= SAVED_PENS_MAX}
          onClick={onSave}
          data-testid="save-pen"
        >
          {PlusIcon}
        </button>
      </div>
    </fieldset>
  );
};
