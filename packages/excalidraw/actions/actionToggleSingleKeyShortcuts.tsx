import { CaptureUpdateAction } from "@excalidraw/element";

import { announce } from "../a11y";
import { t } from "../i18n";

import { register } from "./register";

/**
 * WCAG 2.1.4 (Character Key Shortcuts): lets users turn off the
 * single-character tool shortcuts (r, o, d, v, 1…) so accidental
 * keystrokes — e.g. from speech input or a screen reader's browse mode —
 * can't silently switch tools. Persisted per browser.
 */
export const actionToggleSingleKeyShortcuts = register({
  name: "toggleSingleKeyShortcuts",
  label: "labels.toggleSingleKeyShortcuts",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.singleKeyShortcutsEnabled,
  },
  perform(elements, appState) {
    const singleKeyShortcutsEnabled = !this.checked!(appState);
    announce(
      singleKeyShortcutsEnabled
        ? t("a11y.singleKeyShortcutsEnabled")
        : t("a11y.singleKeyShortcutsDisabled"),
    );
    return {
      appState: {
        ...appState,
        singleKeyShortcutsEnabled,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.singleKeyShortcutsEnabled,
});
