import { Dialog } from "../components/Dialog";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";

import type { TranslationKeys } from "../i18n";

export const a11yHelpDialogAtom = atom(false);

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "browseTitle",
    items: ["browse1", "browse2", "browse3", "browse4", "browse5"],
  },
  { title: "createTitle", items: ["create1", "create2", "create3"] },
  { title: "textTitle", items: ["text1", "text2"] },
  { title: "editTitle", items: ["edit1", "edit2", "edit3"] },
  { title: "connectTitle", items: ["connect1", "connect2", "connect3"] },
  { title: "pointsTitle", items: ["points1", "points2", "points3"] },
  { title: "cropTitle", items: ["crop1", "crop2"] },
  { title: "imageTitle", items: ["image1"] },
  { title: "regionsTitle", items: ["regions1", "regions2"] },
  { title: "settingsTitle", items: ["settings1"] },
  { title: "moreTitle", items: ["more1", "more2"] },
];

const helpText = (key: string) =>
  t(`a11y.helpDialog.${key}` as TranslationKeys);

/**
 * "How to navigate with a screen reader" — a quick keyboard reference
 * designed to be read linearly with a screen reader (plain headings and
 * lists, no interactive widgets). Opened from the visually hidden help
 * region, the command palette, or Alt+Shift+H; closes with Escape.
 */
export const A11yHelpDialog = () => {
  const [isOpen, setOpen] = useAtom(a11yHelpDialogAtom);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={() => setOpen(false)}
      title={t("a11y.helpDialog.title")}
      size="small"
      className="a11y-help-dialog"
    >
      <p>{helpText("intro")}</p>
      {SECTIONS.map(({ title, items }) => (
        <section key={title}>
          <h3>{helpText(title)}</h3>
          <ul>
            {items.map((item) => (
              <li key={item}>{helpText(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
};
