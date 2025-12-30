import type { ExcalidrawElement } from "@excalidraw/element/types";

export type PollResultVisibility = "live" | "creator" | "reveal";
export type PollAccess = "all" | "editors";
export type PollDisplayMode = "percent" | "count";
export type PollState = "idle" | "open" | "closed";

export type PollOption = {
  id: string;
  label: string;
};

export type PollMetadata = {
  id: string;
  question: string;
  options: PollOption[];
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

export type PollElement = ExcalidrawElement & {
  customData?: Record<string, any> & { poll?: PollMetadata };
};
