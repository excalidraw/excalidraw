import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider } from "../editor-jotai";

import {
  TTADialogPanel,
  type TTADialogPanelActions,
  type TTADialogPanelView,
} from "./TTADialogPanel";

import type { ChatMessage } from "./types";

// TTAChatMessage renders assistant thumbnails through the preview hook —
// irrelevant here, so stub it to the idle state.
vi.mock("./useAIAssistantPreview", () => ({
  useAIAssistantPreview: () => ({ previewSvg: null, status: "idle" }),
  evictAssistantPreviews: vi.fn(),
}));

const RERUN_LABEL = "Run again";

const user = (id: string, content: string, images?: string[]): ChatMessage => ({
  id,
  role: "user",
  content,
  images,
  createdAt: 1,
});

const doneAssistant = (id: string): ChatMessage => ({
  id,
  role: "assistant",
  createdAt: 2,
  status: { kind: "done", elapsedMs: 10, outcome: "generated" },
});

const createView = (
  overrides: Partial<TTADialogPanelView>,
): TTADialogPanelView => ({
  hasConversation: true,
  isSendingChat: false,
  isHistoryVisible: false,
  isPinned: true,
  shouldShowSupportBanner: false,
  composerInputValue: "",
  composerImages: [],
  previewModal: null,
  chatMessages: [],
  chatHistory: [],
  latestHistoryChat: null,
  latestRetryableAssistantMessageId: null,
  rateLimits: null,
  isConfirmDialogOpen: false,
  ...overrides,
});

const createActions = (): TTADialogPanelActions => ({
  onStartNewChat: vi.fn(),
  onToggleHistory: vi.fn(),
  onTogglePinned: vi.fn(),
  onClose: vi.fn(),
  onClosePreviewModal: vi.fn(),
  onOpenPreviewModal: vi.fn(),
  onInsertResult: vi.fn(),
  onRetry: vi.fn(),
  onRerunMessage: vi.fn(),
  onRequestDelete: vi.fn(),
  scrollChatToBottom: vi.fn(),
  onDismissSupportBanner: vi.fn(),
  onSelectHistoryChat: vi.fn(),
  onDeleteHistoryChat: vi.fn(),
  onRenameHistoryChat: vi.fn(),
  onHideHistory: vi.fn(),
});

const renderPanel = (view: TTADialogPanelView) => {
  const actions = createActions();
  render(
    <EditorJotaiProvider>
      <TTADialogPanel
        view={view}
        actions={actions}
        chatHistoryRef={React.createRef<HTMLDivElement>()}
        composer={null}
      />
    </EditorJotaiProvider>,
  );
  return actions;
};

describe("TTADialogPanel re-run affordance (§5.8)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders on a trailing prompt-only user turn and re-runs that exact message", () => {
    const trailing = user("user-2", "add a dog", ["data:image/jpeg;base64,x"]);
    const actions = renderPanel(
      createView({
        chatMessages: [
          user("user-1", "draw a cat"),
          doneAssistant("assistant-1"),
          trailing,
        ],
      }),
    );

    const rerunButtons = screen.getAllByRole("button", { name: RERUN_LABEL });
    // exactly one — never on mid-list user turns
    expect(rerunButtons).toHaveLength(1);

    fireEvent.click(rerunButtons[0]);
    expect(actions.onRerunMessage).toHaveBeenCalledTimes(1);
    expect(actions.onRerunMessage).toHaveBeenCalledWith(trailing);
  });

  it("is hidden while a generation is in flight", () => {
    renderPanel(
      createView({
        isSendingChat: true,
        chatMessages: [
          user("user-1", "draw a cat"),
          doneAssistant("assistant-1"),
          user("user-2", "add a dog"),
        ],
      }),
    );

    expect(
      screen.queryByRole("button", { name: RERUN_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("is hidden when the trailing turn has an assistant reply", () => {
    renderPanel(
      createView({
        chatMessages: [
          user("user-1", "draw a cat"),
          doneAssistant("assistant-1"),
        ],
      }),
    );

    expect(
      screen.queryByRole("button", { name: RERUN_LABEL }),
    ).not.toBeInTheDocument();
  });
});
