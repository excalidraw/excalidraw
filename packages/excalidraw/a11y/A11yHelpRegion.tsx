import { editorJotaiStore } from "../editor-jotai";
import { t } from "../i18n";

import { a11yHelpDialogAtom } from "./A11yHelpDialog";

/**
 * Visually-hidden quick guide for screen reader users, placed at the top
 * of the editor so it is the first thing encountered in browse mode.
 * Items are a list so screen readers can jump/skim them one by one.
 * Contains the (equally visually hidden) menu entry that opens the full
 * "How to navigate with a screen reader" dialog.
 */
export const A11yHelpRegion = () => (
  <section
    className="excalidraw-a11y-help-region"
    aria-label={t("a11y.help.title")}
  >
    <h2>{t("a11y.help.title")}</h2>
    <ul>
      <li>{t("a11y.help.browse")}</li>
      <li>{t("a11y.help.spatial")}</li>
      <li>{t("a11y.help.create")}</li>
      <li>{t("a11y.help.focusCanvas")}</li>
      <li>
        <button
          type="button"
          onClick={() => editorJotaiStore.set(a11yHelpDialogAtom, true)}
        >
          {t("a11y.help.openGuide")}
        </button>
      </li>
    </ul>
  </section>
);
