import { atom } from "jotai";
import { jotaiStore } from "../../jotai";
import type React from "react";

export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      description: React.ReactNode;
      actionLabel: string;
      color: "danger" | "warning";

      onClose: () => void;
      onConfirm: () => void;
      onReject: () => void;
    }
  | { active: false };

export const overwriteConfirmStateAtom = atom<OverwriteConfirmState>({
  active: false,
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
  color: "danger" | "warning";
}) {
  return new Promise<boolean>((resolve) => {
    jotaiStore.set(overwriteConfirmStateAtom, {
      active: true,
      onConfirm: () => resolve(true),
      onClose: () => resolve(false),
      onReject: () => resolve(false),
      title,
      description,
      actionLabel,
      color,
    });
  });
}
