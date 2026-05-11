import { atom, editorJotaiStore } from "../../editor-jotai";

import type React from "react";

export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      description: React.ReactNode;
      actionLabel: string;
      color: "danger" | "warning";
      viewOnlyLabel?: string;

      onClose: () => void;
      onConfirm: () => void;
      onReject: () => void;
      onViewOnly?: () => void;
    }
  | { active: false };

export const overwriteConfirmStateAtom = atom<OverwriteConfirmState>({
  active: false,
});

export type OverwriteConfirmResult = "confirm" | "viewOnly" | "cancel";

export async function openConfirmModal({
  title,
  description,
  actionLabel,
  color,
  viewOnlyLabel,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  color: "danger" | "warning";
  viewOnlyLabel?: string;
}): Promise<OverwriteConfirmResult> {
  return new Promise<OverwriteConfirmResult>((resolve) => {
    editorJotaiStore.set(overwriteConfirmStateAtom, {
      active: true,
      onConfirm: () => resolve("confirm"),
      onClose: () => resolve("cancel"),
      onReject: () => resolve("cancel"),
      onViewOnly: viewOnlyLabel ? () => resolve("viewOnly") : undefined,
      title,
      description,
      actionLabel,
      color,
      viewOnlyLabel,
    });
  });
}

