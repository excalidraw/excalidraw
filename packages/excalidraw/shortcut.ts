import { isDarwin } from "@excalidraw/common";

import { t } from "./i18n";

export const getShortcutKey = (shortcut: string): string =>
  shortcut
    .replace(/\bAlt\b/i, isDarwin ? t("keys.option") : t("keys.alt"))
    .replace(/\bShift\b/i, t("keys.shift"))
    .replace(/\b(Enter|Return)\b/i, t("keys.enter"))
    .replace(/\bCtrlOrCmd\b/gi, isDarwin ? t("keys.cmd") : t("keys.ctrl"))
    .replace(/\bEscape\b/i, t("keys.escape"))
    .replace(/\b(Space|Spacebar)\b/i, t("keys.spacebar"))
    .replace(/\b(Del|Delete)\b/i, t("keys.delete"));
