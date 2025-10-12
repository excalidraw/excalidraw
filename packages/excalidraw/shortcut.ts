import { isDarwin } from "@excalidraw/common";

import { t } from "./i18n";

export const getShortcutKey = (shortcut: string): string =>
  shortcut
    .replace(
      /\b(Opt(?:ion)?|Alt)\b/i,
      isDarwin ? t("keys.option") : t("keys.alt"),
    )
    .replace(/\bShift\b/i, t("keys.shift"))
    .replace(/\b(Enter|Return)\b/i, t("keys.enter"))
    .replace(
      /\b(Ctrl|Cmd|Command|CtrlOrCmd)\b/gi,
      isDarwin ? t("keys.cmd") : t("keys.ctrl"),
    )
    .replace(/\b(Esc(?:ape)?)\b/i, t("keys.escape"))
    .replace(/\b(Space(?:bar)?)\b/i, t("keys.spacebar"))
    .replace(/\b(Del(?:ete)?)\b/i, t("keys.delete"));
