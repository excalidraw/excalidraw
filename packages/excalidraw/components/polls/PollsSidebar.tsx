import clsx from "clsx";
import React, { useMemo, useState } from "react";

import { t } from "../../i18n";
import type { PollMetadata } from "../../poll/types";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
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
      ? polls.filter((poll) =>
          poll.question.toLowerCase().includes(trimmed),
        )
      : polls;
    return sortPolls(matches);
  }, [polls, query]);

  const selectedPoll =
    polls.find((poll) => poll.id === appState.selectedPollId) || null;
  const detailPoll = selectedPoll || filteredPolls[0] || null;

  const handleCreatePoll = () => {
    app.createPoll();
    setQuery("");
  };

  return (
    <div className="excalidraw__polls-sidebar">
      <div className="excalidraw__polls-sidebar__controls">
        <button
          type="button"
          className="excalidraw__poll-button excalidraw__polls-sidebar__new"
          onClick={handleCreatePoll}
        >
          + {t("poll.newPoll")}
        </button>
        <input
          type="search"
          className="excalidraw__polls-sidebar__search"
          placeholder={t("poll.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
              return (
                <li key={poll.id} className="excalidraw__polls-sidebar__item">
                  <button
                    type="button"
                    className={clsx(
                      "excalidraw__polls-sidebar__item-button",
                      isSelected && "is-selected",
                    )}
                    onClick={() =>
                      setAppState({ selectedPollId: poll.id })
                    }
                  >
                    <div className="excalidraw__polls-sidebar__item-title">
                      {poll.question || t("poll.questionPlaceholder")}
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
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="excalidraw__polls-sidebar__detail">
        {detailPoll ? (
          <PollCard
            metadata={detailPoll}
            isSelected={true}
            canEdit={appState.viewModeEnabled === false}
            canVote={
              detailPoll.status.state === "open" &&
              (detailPoll.settings.access === "all" ||
                appState.viewModeEnabled === false)
            }
            isOwner={app.isPollOwner(detailPoll)}
            voteSelection={app.getPollSelection(detailPoll.id)}
            counts={app.getPollCountsAsObject(detailPoll)}
            onChange={(updater) => {
              app.updatePollMetadata(detailPoll.id, updater);
            }}
            onVote={(optionIds) => app.handlePollVote(detailPoll.id, optionIds)}
            onStart={() => app.startPoll(detailPoll.id)}
            onStop={() => app.stopPoll(detailPoll.id)}
            onReveal={(value) => app.togglePollReveal(detailPoll.id, value)}
            now={Date.now()}
          />
        ) : (
          <div className="excalidraw__polls-sidebar__detail-empty">
            {t("poll.noPolls")}
          </div>
        )}
      </div>
    </div>
  );
};