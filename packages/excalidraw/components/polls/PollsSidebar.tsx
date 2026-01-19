import clsx from "clsx";
import React, { useMemo, useState } from "react";

import { t } from "../../i18n";

import type { PollMetadata } from "../../poll/types";

import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
import { searchIcon } from "../icons";
import { TextField } from "../TextField";

import { PollCard } from "./PollCard";

import "./PollsSidebar.scss";

const getPollStatusLabel = (poll: PollMetadata) => {
  switch (poll.status.state) {
    case "open":
      return t("poll.statusOpen");
    case "closed":
      return t("poll.statusClosed");
    case "idle":
      return t("poll.statusIdle");
    default:
      return poll.status.state;
  }
};

const getTotalVotes = (counts: Record<string, number>) => {
  return Object.values(counts).reduce((acc, value) => acc + value, 0);
};

const sortPolls = (polls: readonly PollMetadata[]) => {
  return [...polls].sort((a, b) => {
    const aOpen = a.status.state === "open";
    const bOpen = b.status.state === "open";
    if (aOpen !== bOpen) {
      return aOpen ? -1 : 1;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
};

export const PollsSidebar = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const [query, setQuery] = useState("");

  const polls = appState.polls;

  const filteredPolls = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const matches = trimmed
      ? polls.filter((poll) => poll.question.toLowerCase().includes(trimmed))
      : polls;
    return sortPolls(matches);
  }, [polls, query]);

  const handleCreatePoll = () => {
    app.createPoll();
    setQuery("");
  };
  const now = Date.now();
  const canEdit = appState.viewModeEnabled === false;

  return (
    <div className="excalidraw__polls-sidebar">
      <div className="excalidraw__polls-sidebar__controls">
        <button
          type="button"
          className="excalidraw-button excalidraw__poll-button excalidraw__polls-sidebar__new"
          onClick={handleCreatePoll}
        >
          + {t("poll.newPoll")}
        </button>
        <TextField
          className="excalidraw__polls-sidebar__search"
          placeholder={t("poll.searchPlaceholder")}
          value={query}
          icon={searchIcon}
          onChange={(value) => setQuery(value)}
          type="search"
          fullWidth
        />
      </div>

      <div className="excalidraw__polls-sidebar__list">
        {filteredPolls.length === 0 ? (
          <div className="excalidraw__polls-sidebar__empty">
            {t("poll.noPolls")}
          </div>
        ) : (
          <ul className="excalidraw__polls-sidebar__items">
            {filteredPolls.map((poll) => {
              const counts = app.getPollCountsAsObject(poll);
              const totalVotes = getTotalVotes(counts);
              const statusLabel = getPollStatusLabel(poll);
              const isSelected = poll.id === appState.selectedPollId;
              const isLive = poll.status.state === "open";
              const canRename = isSelected && canEdit && !isLive;
              const canVote =
                poll.status.state === "open" &&
                (poll.settings.access === "all" ||
                  appState.viewModeEnabled === false);
              const toggleSelection = () =>
                setAppState({
                  selectedPollId: isSelected ? null : poll.id,
                });
              return (
                <li key={poll.id} className="excalidraw__polls-sidebar__item">
                  <div
                    className={clsx(
                      "excalidraw__polls-sidebar__item-card",
                      isSelected && "is-selected",
                      canRename && "is-editable",
                    )}
                  >
                    <div
                      className="excalidraw__polls-sidebar__item-button"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isSelected}
                      onClick={toggleSelection}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleSelection();
                        }
                      }}
                    >
                      <div className="excalidraw__polls-sidebar__item-title">
                        {canRename ? (
                          <input
                            className="excalidraw__polls-sidebar__item-title-input"
                            value={poll.question}
                            placeholder={t("poll.questionPlaceholder")}
                            onChange={(event) =>
                              app.updatePollMetadata(poll.id, (prev) => ({
                                ...prev,
                                question: event.target.value,
                              }))
                            }
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        ) : (
                          <span className="excalidraw__polls-sidebar__item-title-text">
                            {poll.question || t("poll.questionPlaceholder")}
                          </span>
                        )}
                      </div>
                      <div className="excalidraw__polls-sidebar__item-meta">
                        <span
                          className={clsx(
                            "excalidraw__polls-sidebar__item-status",
                            `is-${poll.status.state}`,
                          )}
                        >
                          {statusLabel}
                        </span>
                        <span className="excalidraw__polls-sidebar__item-votes">
                          {t("poll.totalVotes", { count: totalVotes })}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="excalidraw__polls-sidebar__item-detail">
                        <PollCard
                          metadata={poll}
                          isSelected={true}
                          canEdit={canEdit}
                          canVote={canVote}
                          isOwner={app.isPollOwner(poll)}
                          voteSelection={app.getPollSelection(poll.id)}
                          counts={counts}
                          showQuestionInput={false}
                          onChange={(updater) => {
                            app.updatePollMetadata(poll.id, updater);
                          }}
                          onVote={(optionIds) =>
                            app.handlePollVote(poll.id, optionIds)
                          }
                          onStart={() => app.startPoll(poll.id)}
                          onStop={() => app.stopPoll(poll.id)}
                          onReveal={(value) =>
                            app.togglePollReveal(poll.id, value)
                          }
                          now={now}
                          showTotalVotes={false}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
