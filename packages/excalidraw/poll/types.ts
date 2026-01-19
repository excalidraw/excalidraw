export type PollResultVisibility = "live" | "creator" | "reveal";
export type PollAccess = "all" | "editors";
export type PollDisplayMode = "percent" | "count";
export type PollState = "idle" | "open" | "closed";

export type PollOption = {
  id: string;
  label: string;
};

export type PollBallot = {
  optionIds: string[];
  updatedAt: number;
};

export type PollMetadata = {
  id: string;
  createdAt: number;
  question: string;
  options: PollOption[];
  results?: Record<string, number>;
  ballots?: Record<string, PollBallot>;
  settings: {
    allowMultiple: boolean;
    allowRevote: boolean;
    access: PollAccess;
    limitPerSession: boolean;
    resultVisibility: PollResultVisibility;
    displayMode: PollDisplayMode;
    timerSeconds: number | null;
    privacy: "anonymous";
    createdBy: string;
  };
  status: {
    state: PollState;
    closesAt: number | null;
    revealResults: boolean;
    lockedOptions: boolean;
  };
};
