import { atom } from "jotai";
import { jotaiStore } from "../../jotai";
import React from "react";

export type OverwriteConfirmState = {
  active: boolean;

  onClose?: () => void;
  title?: string;
  description?: React.ReactNode;
  actionLabel?: string;
  color?: "danger" | "warning";

  onConfirm?: () => void;
  onReject?: () => void;
};

export const overwriteConfirmState = atom<OverwriteConfirmState>({
  active: false,
  onClose: () => {},
});

export async function openConfirmModal({
  title,
  description,
  actionLabel,
  color,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  color?: "danger" | "warning";
}) {
  return new Promise<boolean>((resolve) => {
    jotaiStore.set(overwriteConfirmState, {
      active: true,
      onConfirm: () => resolve(true),
      onClose: () => resolve(false),
      onReject: () => resolve(false),
      title,
      description,
      actionLabel,
      color: color ?? "danger",
    });
  });
}
