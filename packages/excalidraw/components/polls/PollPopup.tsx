import React, { useMemo, useState } from "react";

import { t } from "../../i18n";
import type { PollMetadata } from "../../poll/types";
import { PollCard } from "./PollCard";

type PollPopupProps = {
  polls: readonly PollMetadata[];
  selectedPollId: string | null;
  viewModeEnabled: boolean;
  pollSessionId: string;
  getPollCountsAsObject: (poll: PollMetadata) => Record<string, number>;
  getPollSelection: (pollId: string) => readonly string[];
  updatePollMetadata: (
    pollId: string,
    updater: (poll: PollMetadata) => PollMetadata,
  ) => void;
  handlePollVote: (pollId: string, optionIds: string[]) => void;
  startPoll: (pollId: string) => void;
  stopPoll: (pollId: string) => void;
  togglePollReveal: (pollId: string, reveal: boolean) => void;
};

const sortPolls = (
  polls: readonly PollMetadata[],
  selectedPollId: string | null,
) => {
  const sorted = [...polls].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );
  if (!selectedPollId) {
    return sorted;
  }
  const selectedIndex = sorted.findIndex(
    (poll) => poll.id === selectedPollId,
  );
  if (selectedIndex > 0) {
    const [selected] = sorted.splice(selectedIndex, 1);
    sorted.unshift(selected);
  }
  return sorted;
};

export const PollPopup = ({
                            polls,
                            selectedPollId,
                            viewModeEnabled,
                            pollSessionId,
                            getPollCountsAsObject,
                            getPollSelection,
                            updatePollMetadata,
                            handlePollVote,
                            startPoll,
                            stopPoll,
                            togglePollReveal,
                          }: PollPopupProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const openPolls = useMemo(() => {
    const active = polls.filter((poll) => poll.status.state === "open");
    return sortPolls(active, selectedPollId);
  }, [polls, selectedPollId]);

  if (!openPolls.length) {
    return null;
  }

  const now = Date.now();

  return (
    <div
      className="excalidraw__poll-popup"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="excalidraw__poll-popup-inner">
        <div className="excalidraw__poll-popup-header">
          <div className="excalidraw__poll-popup-title">
            {t("toolBar.poll")} ({openPolls.length})
          </div>
          <button
            type="button"
            className="excalidraw-button excalidraw__poll-button excalidraw__poll-popup-toggle"
            onClick={() => setIsCollapsed((prev) => !prev)}
          >
            {isCollapsed ? t("poll.expand") : t("poll.collapse")}
          </button>
        </div>
        {!isCollapsed &&
          openPolls.map((poll) => {
            const counts = getPollCountsAsObject(poll);
            const voteSelection = getPollSelection(poll.id);
            const isOwner = poll.settings.createdBy === pollSessionId;
            const canVote =
              poll.settings.access === "all" || viewModeEnabled === false;

            return (
              <PollCard
                key={poll.id}
                metadata={poll}
                isSelected={false}
                canEdit={false}
                canVote={canVote}
                isOwner={isOwner}
                voteSelection={voteSelection}
                counts={counts}
                onChange={(updater) => {
                  updatePollMetadata(poll.id, updater);
                }}
                onVote={(optionIds) => handlePollVote(poll.id, optionIds)}
                onStart={() => startPoll(poll.id)}
                onStop={() => stopPoll(poll.id)}
                onReveal={(value) => togglePollReveal(poll.id, value)}
                now={now}
              />
            );
          })}
      </div>
    </div>
  );
};
