import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { vi } from "vitest";

import { resolvablePromise } from "@excalidraw/common";
import * as clipboard from "@excalidraw/excalidraw/clipboard";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import { EditorJotaiProvider } from "@excalidraw/excalidraw/editor-jotai";
import { t } from "@excalidraw/excalidraw/i18n";

import { Provider, appJotaiStore } from "../app-jotai";
import { activeRoomLinkAtom } from "../collab/Collab";
import { ShareDialog, shareDialogStateAtom } from "../share/ShareDialog";

import type { CollabAPI } from "../collab/Collab";

vi.mock("@excalidraw/excalidraw/components/Dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock(
  "@excalidraw/excalidraw/context/ui-appState",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@excalidraw/excalidraw/context/ui-appState")
    >()),
    useUIAppState: () => ({ openDialog: null }),
  }),
);

vi.mock("../share/QRCode", () => ({ QRCode: () => null }));

vi.mock("../collab/Collab", async () => {
  const { atom } = await import("../app-jotai");
  return { activeRoomLinkAtom: atom<string | null>(null) };
});

describe.each(["shareable", "collaboration"] as const)(
  "%s link clipboard feedback",
  (kind) => {
    const link =
      kind === "shareable"
        ? "https://excalidraw.com/#json=scene,key"
        : "https://excalidraw.com/#room=room,key";

    const renderDialog = (onError: (message: string) => void) => {
      if (kind === "shareable") {
        render(
          <ShareableLinkDialog
            link={link}
            onCloseRequest={vi.fn()}
            setErrorMessage={onError}
          />,
          { wrapper: EditorJotaiProvider },
        );
      } else {
        appJotaiStore.set(activeRoomLinkAtom, link);
        appJotaiStore.set(shareDialogStateAtom, {
          isOpen: true,
          type: "share",
        });

        const collabAPI = {
          getUsername: () => "Test user",
          setUsername: vi.fn(),
          setCollabError: onError,
          stopCollaboration: vi.fn(),
          isCollaborating: () => true,
        } as unknown as CollabAPI;

        render(
          <Provider store={appJotaiStore}>
            <ShareDialog collabAPI={collabAPI} onExportToBackend={vi.fn()} />
          </Provider>,
          { wrapper: EditorJotaiProvider },
        );
      }

      return screen.getByRole("button", { name: t("buttons.copyLink") });
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      cleanup();
      appJotaiStore.set(activeRoomLinkAtom, null);
      appJotaiStore.set(shareDialogStateAtom, { isOpen: false });
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("shows success only after the clipboard write completes", async () => {
      const write = resolvablePromise<void>();
      const copy = vi
        .spyOn(clipboard, "copyTextToSystemClipboard")
        .mockReturnValue(write);
      const onError = vi.fn();
      const button = renderDialog(onError);

      fireEvent.click(button);

      expect(copy).toHaveBeenCalledWith(link);
      expect(button).not.toHaveClass("ExcButton--status-success");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });

      expect(button).toHaveClass("ExcButton--status-loading");
      expect(button).toBeDisabled();

      await act(async () => {
        write.resolve();
        await write;
      });

      expect(button).toHaveClass("ExcButton--status-success");
      expect(button).not.toHaveClass("ExcButton--status-loading");
      expect(onError).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(button).not.toHaveClass("ExcButton--status-success");
      expect(button).toBeEnabled();
    });

    it("reports a failed write without success feedback and allows retry", async () => {
      const write = resolvablePromise<void>();
      const copy = vi
        .spyOn(clipboard, "copyTextToSystemClipboard")
        .mockReturnValueOnce(write);
      const onError = vi.fn();
      const button = renderDialog(onError);

      fireEvent.click(button);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
        write.reject(new Error("Clipboard access denied"));
      });

      expect(onError).toHaveBeenCalledWith(
        t("errors.copyToSystemClipboardFailed"),
      );
      expect(button).not.toHaveClass("ExcButton--status-success");
      expect(button).not.toHaveClass("ExcButton--status-loading");
      expect(button).toBeEnabled();

      const input = screen.getByDisplayValue(link) as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(link.length);

      copy.mockResolvedValueOnce(undefined);
      await act(async () => {
        fireEvent.click(button);
      });

      expect(copy).toHaveBeenCalledTimes(2);
      expect(button).toHaveClass("ExcButton--status-success");
      expect(onError).toHaveBeenCalledTimes(1);
    });
  },
);
