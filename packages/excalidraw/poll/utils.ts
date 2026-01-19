import { nanoid } from "nanoid";

import type { PollMetadata } from "./types";

export const createDefaultPoll = (createdBy: string): PollMetadata => {
  const options = [
    { id: nanoid(), label: "Option 1" },
    { id: nanoid(), label: "Option 2" },
  ];

  return {
    id: nanoid(),
    createdAt: Date.now(),
    question: "New Poll",
    options,
    results: options.reduce<Record<string, number>>((acc, option) => {
      acc[option.id] = 0;
      return acc;
    }, {}),
    ballots: {},
    settings: {
      allowMultiple: false,
      allowRevote: true,
      access: "editors",
      limitPerSession: true,
      resultVisibility: "live",
      displayMode: "percent",
      timerSeconds: null,
      privacy: "anonymous",
      createdBy,
    },
    status: {
      state: "idle",
      closesAt: null,
      revealResults: false,
      lockedOptions: false,
    },
  };
};
