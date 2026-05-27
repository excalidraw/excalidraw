import { isTextElement } from "@excalidraw/element";

import type App from "../components/App";

// Common diagramming / flowchart terms that show up over and over in
// real-world excalidraw boards. Used as the seed corpus so suggestions
// work even on an empty canvas.
const COMMON_TERMS = [
  // Flow control
  "Start",
  "Begin",
  "End",
  "Stop",
  "Finish",
  "Done",
  "Cancel",
  "Submit",
  "Continue",
  "Retry",
  // Yes/no
  "Yes",
  "No",
  "True",
  "False",
  "Maybe",
  // Process steps
  "Decision",
  "Process",
  "Action",
  "Step",
  "Input",
  "Output",
  "Check",
  "Validate",
  "Review",
  "Approve",
  "Reject",
  // Roles & actors
  "User",
  "Admin",
  "Customer",
  "Client",
  "Server",
  "Worker",
  "System",
  // Services
  "Database",
  "Cache",
  "Queue",
  "Service",
  "API",
  "Frontend",
  "Backend",
  "Mobile",
  "Web",
  "Browser",
  // CRUD
  "Create",
  "Read",
  "Update",
  "Delete",
  "Fetch",
  "Save",
  "Load",
  "Send",
  "Receive",
  // Auth
  "Login",
  "Logout",
  "Signup",
  "Signin",
  "Authenticate",
  "Authorize",
  "Token",
  "Session",
  // Outcomes
  "Success",
  "Failure",
  "Error",
  "Warning",
  "Info",
  "Loading",
  "Pending",
  "Active",
  "Inactive",
  "Archived",
  "Draft",
  "Published",
  // Project / planning
  "Project",
  "Team",
  "Sprint",
  "Milestone",
  "Goal",
  "Plan",
  "Task",
  "Issue",
  "Feature",
  "Bug",
  "Question",
  "Answer",
  "Idea",
  "Note",
  // Environments
  "Production",
  "Staging",
  "Development",
  "Testing",
];

const WORD_SPLIT_RE = /[\s,.\-:;!?()/\\[\]{}'"`]+/;

/**
 * Pull every distinct ≥3-char "word" off any text element currently on the
 * canvas. We use this to bias suggestions toward terminology the user is
 * already using on this particular board.
 */
export const buildCorpusFromScene = (app: App): string[] => {
  const elements = app.scene.getNonDeletedElements();
  const words = new Set<string>();
  for (const el of elements) {
    if (isTextElement(el) && el.text) {
      for (const raw of el.text.split(WORD_SPLIT_RE)) {
        // Strip leading/trailing residual punctuation, keep internal hyphens
        const word = raw.trim();
        if (word.length >= 3) {
          words.add(word);
        }
      }
    }
  }
  return Array.from(words);
};

export type SuggestionEngine = {
  getSuggestion: (
    value: string,
    cursorOffset: number,
    currentElementId: string,
  ) => string | null;
  refreshCorpus: () => void;
};

/**
 * Builds a suggestion engine for a given app. The engine merges a built-in
 * corpus of common diagramming words with words harvested from text elements
 * already on the canvas. Call refreshCorpus() if the canvas changes.
 */
export const createSuggestionEngine = (app: App): SuggestionEngine => {
  let corpus: string[] = [...COMMON_TERMS];

  const refreshCorpus = () => {
    const sceneWords = buildCorpusFromScene(app);
    // de-dupe while preserving order (canvas words first so they win on ties)
    const merged = new Set<string>(sceneWords);
    for (const word of COMMON_TERMS) {
      merged.add(word);
    }
    corpus = Array.from(merged);
  };

  refreshCorpus();

  const getSuggestion = (
    value: string,
    cursorOffset: number,
    currentElementId: string,
  ): string | null => {
    // Only suggest when the caret is at the very end of the text — anywhere
    // else, inserting a completion at the cursor would look like teleportation.
    if (cursorOffset !== value.length) {
      return null;
    }

    // Find the start of the word the user is currently typing.
    const lastBreak = Math.max(
      value.lastIndexOf(" ", cursorOffset - 1),
      value.lastIndexOf("\n", cursorOffset - 1),
      value.lastIndexOf("\t", cursorOffset - 1),
    );
    const wordStart = lastBreak + 1;
    const prefix = value.slice(wordStart, cursorOffset);

    // Need at least 2 chars before we attempt to suggest, to avoid being
    // noisy on the first keystroke.
    if (prefix.length < 2) {
      return null;
    }

    // Skip if the prefix already ends in non-letter chars (e.g. punctuation).
    if (!/[A-Za-z]$/.test(prefix)) {
      return null;
    }

    const prefixLower = prefix.toLowerCase();

    for (const word of corpus) {
      const wordLower = word.toLowerCase();
      if (
        wordLower.startsWith(prefixLower) &&
        wordLower !== prefixLower &&
        // Don't suggest the exact string the user has currently typed
        word !== value
      ) {
        // Return just the completion suffix — keep the case the user already
        // typed and append the remainder using the corpus word's case.
        return word.slice(prefix.length);
      }
    }
    return null;
  };

  return { getSuggestion, refreshCorpus };
};
