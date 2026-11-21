import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { t } from "../../i18n";

/**
 * "drag to pin" hint shown in a picker popup whose top picks are
 * customizable — with a reset link while the picks are customized
 */
export const TopPicksTip = ({
  className,
  tip,
  onReset,
  resetTitle,
}: {
  className?: string;
  tip: string;
  /** present only while the top picks are customized */
  onReset?: () => void;
  resetTitle: string;
}) => (
  <div className={clsx("top-picks-dnd__tip", className)}>
    {tip}
    {onReset && (
      <>
        {" · "}
        <button
          type="button"
          className="top-picks-dnd__tip-reset"
          title={resetTitle}
          // the link unmounts on reset — don't let it take the focus
          // (it'd drop to <body>, killing the picker's keyboard handling)
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            // ...and when it had it (keyboard), hand it back to the picker
            const focusTarget =
              event.currentTarget.ownerDocument.activeElement ===
              event.currentTarget
                ? event.currentTarget.parentElement?.closest<HTMLElement>(
                    "[tabindex]",
                  )
                : null;
            onReset();
            focusTarget?.focus();
          }}
          onKeyDown={(event) => {
            // the pickers' key handlers act on these (e.g. Enter picks the
            // hovered font) — keep them to the button
            if (event.key === KEYS.ENTER || event.key === KEYS.SPACE) {
              event.stopPropagation();
            }
          }}
        >
          {t("buttons.reset")}
        </button>
      </>
    )}
  </div>
);
