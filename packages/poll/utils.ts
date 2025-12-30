import { nanoid } from "nanoid";

import type { PollElement, PollMetadata } from "./types";

export const isPollElement = (element: any): element is PollElement => {
  return Boolean(element?.customData?.poll);
};

export const createDefaultPoll = (createdBy: string): PollMetadata => {
  return {
    id: nanoid(),
    question: "New Poll",
    options: [
      { id: nanoid(), label: "Option 1" },
      { id: nanoid(), label: "Option 2" },
    ],
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
