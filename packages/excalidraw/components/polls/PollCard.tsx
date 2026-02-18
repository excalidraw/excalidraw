import clsx from "clsx";
import { nanoid } from "nanoid";
import React, { useState } from "react";

import { t } from "../../i18n";

import { CloseIcon, adjustmentsIcon } from "../icons";

import type { PollMetadata, PollOption } from "../../poll/types";

type PollCardProps = {
  metadata: PollMetadata;
  isSelected: boolean;
  canEdit: boolean;
  canVote: boolean;
  isOwner: boolean;
  voteSelection: readonly string[];
  counts: Record<string, number>;
  onChange: (updater: (prev: PollMetadata) => PollMetadata) => void;
  onVote: (optionIds: string[]) => void;
  onStart: () => void;
  onStop: () => void;
  onReveal: (value: boolean) => void;
  now: number;
  showTotalVotes?: boolean;
  showQuestionInput?: boolean;
};

const clampTimer = (value: number) => {
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  return Math.max(1, Math.min(value, 3600));
};

const getTotalVotes = (counts: Record<string, number>) => {
  return Object.values(counts).reduce((acc, value) => acc + value, 0);
};

const PollOptionsList = ({
  metadata,
  editable,
  optionsEditable,
  voteSelection,
  counts,
  displayResults,
  onChange,
  onVote,
  canVote,
}: {
  metadata: PollMetadata;
  editable: boolean;
  optionsEditable: boolean;
  voteSelection: readonly string[];
  counts: Record<string, number>;
  displayResults: boolean;
  onChange: (next: PollMetadata) => void;
  onVote: (ids: string[]) => void;
  canVote: boolean;
}) => {
  const totalVotes = getTotalVotes(counts);
  const isMulti = metadata.settings.allowMultiple;
  const selection = new Set(voteSelection);

  const toggleVote = (id: string) => {
    if (!canVote) {
      return;
    }

    if (isMulti) {
      const next = new Set(selection);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onVote(Array.from(next));
    } else {
      onVote([id]);
    }
  };

  const changeLabel = (id: string, value: string) => {
    if (!optionsEditable) {
      return;
    }
    onChange({
      ...metadata,
      options: metadata.options.map((option) =>
        option.id === id ? { ...option, label: value } : option,
      ),
    });
  };

  const removeOption = (id: string) => {
    if (!optionsEditable || metadata.options.length <= 2) {
      return;
    }

    onChange({
      ...metadata,
      options: metadata.options.filter((option) => option.id !== id),
    });
  };

  const addOption = () => {
    if (!optionsEditable) {
      return;
    }
    const next: PollOption = {
      id: nanoid(),
      label: `${t("poll.option")} ${metadata.options.length + 1}`,
    };
    onChange({
      ...metadata,
      options: [...metadata.options, next],
    });
  };

  return (
    <div className="excalidraw__poll-options">
      {metadata.options.map((option) => {
        const checked = selection.has(option.id);
        const optionVotes = counts[option.id] || 0;
        const percent =
          totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
        return (
          <div
            key={option.id}
            className={clsx("excalidraw__poll-option", {
              "is-editable": editable,
            })}
          >
            <label className="excalidraw__poll-option__label">
              <input
                type={isMulti ? "checkbox" : "radio"}
                className="excalidraw__poll-selector"
                checked={checked}
                disabled={!canVote}
                onChange={() => toggleVote(option.id)}
              />
              {editable ? (
                <input
                  className="excalidraw__poll-option__input"
                  value={option.label}
                  disabled={!optionsEditable}
                  onChange={(event) =>
                    changeLabel(option.id, event.target.value)
                  }
                />
              ) : (
                <span className="excalidraw__poll-option__text">
                  {option.label}
                </span>
              )}
            </label>
            {optionsEditable && metadata.options.length > 2 && (
              <button
                className="excalidraw__poll-option__remove"
                type="button"
                onClick={() => removeOption(option.id)}
                aria-label={t("poll.removeOption")}
                title={t("poll.removeOption")}
              >
                {CloseIcon}
              </button>
            )}
            {displayResults && (
              <div className="excalidraw__poll-option__result">
                {metadata.settings.displayMode === "percent"
                  ? `${percent}%`
                  : optionVotes}
              </div>
            )}
          </div>
        );
      })}
      {optionsEditable && (
        <div className="excalidraw__poll-options__add">
          <button
            type="button"
            className="excalidraw-button excalidraw__poll-button"
            onClick={addOption}
          >
            {t("poll.addOption")}
          </button>
        </div>
      )}
    </div>
  );
};

export const PollCard = ({
  metadata,
  isSelected,
  canEdit,
  canVote,
  isOwner,
  voteSelection,
  counts,
  onChange,
  onVote,
  onStart,
  onStop,
  onReveal,
  now,
  showTotalVotes = true,
  showQuestionInput = true,
}: PollCardProps) => {
  const isLive = metadata.status.state === "open";
  const editable = canEdit && isSelected && !isLive;
  const isLocked = metadata.status.state === "open";
  const optionsEditable = editable;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const showSettings = showAdvanced && editable;
  const showSettingsToggle = editable;
  const showResults =
    metadata.settings.resultVisibility === "live" ||
    (metadata.settings.resultVisibility === "creator" &&
      (isOwner || metadata.status.state === "closed")) ||
    (metadata.settings.resultVisibility === "reveal" &&
      metadata.status.revealResults);

  const remainingMs =
    metadata.status.state === "open" && metadata.status.closesAt
      ? Math.max(0, metadata.status.closesAt - now)
      : null;

  const toggleSetting = (key: keyof PollMetadata["settings"]) => {
    return (value: any) => {
      onChange((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [key]: value,
        },
      }));
    };
  };

  const totalVotes = getTotalVotes(counts);

  return (
    <div className="excalidraw__poll-card">
      <div
        className="excalidraw__poll-header"
        onDoubleClick={() => setShowAdvanced((prev) => !prev)}
        title={isLocked ? t("poll.showSettingsHint") : undefined}
      >
        {showQuestionInput ? (
          editable ? (
            <input
              className="excalidraw__poll-question"
              value={metadata.question}
              placeholder={t("poll.questionPlaceholder")}
              disabled={isLocked}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, question: event.target.value }))
              }
            />
          ) : (
            <div>{metadata.question}</div>
          )
        ) : null}
        <div
          className={clsx(
            "excalidraw__poll-actions",
            showSettingsToggle && "is-split",
          )}
        >
          <div className="excalidraw__poll-actions__primary">
            {isOwner &&
              (metadata.status.state === "open" ? (
                <button
                  type="button"
                  className="excalidraw-button excalidraw__poll-button"
                  onClick={onStop}
                >
                  {t("poll.stop")}
                </button>
              ) : metadata.status.state === "closed" ? (
                <button
                  type="button"
                  className="excalidraw-button excalidraw__poll-button"
                  onClick={onStart}
                >
                  {t("poll.reopen")}
                </button>
              ) : (
                <button
                  type="button"
                  className="excalidraw-button excalidraw__poll-button"
                  onClick={onStart}
                >
                  {t("poll.start")}
                </button>
              ))}
            {metadata.settings.resultVisibility === "reveal" && (
              <button
                type="button"
                className="excalidraw-button excalidraw__poll-button"
                onClick={() => onReveal(!metadata.status.revealResults)}
              >
                {metadata.status.revealResults
                  ? t("poll.hideResults")
                  : t("poll.revealResults")}
              </button>
            )}
          </div>
          {showSettingsToggle && (
            <div className="excalidraw__poll-actions__secondary">
              <button
                type="button"
                className="excalidraw-button excalidraw__poll-button excalidraw__poll-settings-button"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {adjustmentsIcon}
                <span>
                  {showAdvanced
                    ? t("poll.hideAdvanced")
                    : t("poll.showAdvanced")}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <PollOptionsList
        metadata={metadata}
        editable={editable}
        optionsEditable={optionsEditable}
        voteSelection={voteSelection}
        counts={counts}
        displayResults={showResults}
        onChange={(next) => onChange(() => next)}
        onVote={onVote}
        canVote={canVote && metadata.status.state === "open"}
      />

      {showSettings && (
        <div className="excalidraw__poll-settings">
          <label className="excalidraw__poll-setting">
            <input
              type="checkbox"
              className="excalidraw__poll-selector"
              checked={metadata.settings.allowMultiple}
              onChange={(event) =>
                toggleSetting("allowMultiple")(event.target.checked)
              }
              disabled={!optionsEditable}
            />
            {t("poll.multiChoice")}
          </label>
          <label className="excalidraw__poll-setting">
            <input
              type="checkbox"
              className="excalidraw__poll-selector"
              checked={metadata.settings.allowRevote}
              onChange={(event) =>
                toggleSetting("allowRevote")(event.target.checked)
              }
              disabled={!optionsEditable}
            />
            {t("poll.revote")}
          </label>
          <label className="excalidraw__poll-setting">
            {t("poll.access")}
            <select
              className="excalidraw__poll-select"
              value={metadata.settings.access}
              onChange={(event) =>
                toggleSetting("access")(
                  event.target.value as PollMetadata["settings"]["access"],
                )
              }
              disabled={!optionsEditable}
            >
              <option value="editors">{t("poll.accessEditors")}</option>
              <option value="all">{t("poll.accessAll")}</option>
            </select>
          </label>
          <label className="excalidraw__poll-setting">
            {t("poll.resultsVisibility")}
            <select
              className="excalidraw__poll-select"
              value={metadata.settings.resultVisibility}
              onChange={(event) =>
                toggleSetting("resultVisibility")(
                  event.target
                    .value as PollMetadata["settings"]["resultVisibility"],
                )
              }
              disabled={!optionsEditable}
            >
              <option value="live">{t("poll.visibilityLive")}</option>
              <option value="creator">{t("poll.visibilityCreator")}</option>
              <option value="reveal">{t("poll.visibilityReveal")}</option>
            </select>
          </label>
          <label className="excalidraw__poll-setting">
            {t("poll.displayMode")}
            <select
              className="excalidraw__poll-select"
              value={metadata.settings.displayMode}
              onChange={(event) =>
                toggleSetting("displayMode")(
                  event.target.value as PollMetadata["settings"]["displayMode"],
                )
              }
              disabled={!optionsEditable}
            >
              <option value="percent">{t("poll.displayPercent")}</option>
              <option value="count">{t("poll.displayCount")}</option>
            </select>
          </label>
          <label className="excalidraw__poll-setting">
            {t("poll.timerLabel")}
            <input
              type="number"
              className="excalidraw__poll-input"
              min={1}
              max={3600}
              value={metadata.settings.timerSeconds ?? ""}
              onChange={(event) =>
                toggleSetting("timerSeconds")(
                  clampTimer(Number(event.target.value)),
                )
              }
              disabled={!optionsEditable}
            />
          </label>
        </div>
      )}

      <div className="excalidraw__poll-footer">
        <div className="excalidraw__poll-meta">
          {metadata.status.state === "open" && remainingMs && (
            <span>
              {t("poll.timerCountdown", {
                seconds: Math.ceil(remainingMs / 1000),
              })}
            </span>
          )}
          {!showResults && (
            <span className="excalidraw__poll-results-hidden">
              {t("poll.resultsHidden")}
            </span>
          )}
        </div>
        {showTotalVotes && (
          <div className="excalidraw__poll-total">
            {t("poll.totalVotes", { count: totalVotes })}
          </div>
        )}
      </div>
    </div>
  );
};
