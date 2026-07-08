import { editorJotaiStore } from "../editor-jotai";
import { t } from "../i18n";

import { a11yHelpDialogAtom } from "./A11yHelpDialog";

/**
 * Visually-hidden quick guide for screen reader users, placed at the top
 * of the editor so it is the first thing encountered in browse mode.
 * Contains the (equally visually hidden) menu entry that opens the full
 * "How to navigate with a screen reader" dialog.
 */
export const A11yHelpRegion = () => (
  <section className="visually-hidden" aria-label={t("a11y.help.title")}>
    <h2>{t("a11y.help.title")}</h2>
    <p>{t("a11y.help.browse")}</p>
    <p>{t("a11y.help.create")}</p>
    <button
      type="button"
      className="visually-hidden"
      onClick={() => editorJotaiStore.set(a11yHelpDialogAtom, true)}
    >
      {t("a11y.help.openGuide")}
    </button>
  </section>
);
