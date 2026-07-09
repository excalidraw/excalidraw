import type { ActionManager } from "../../actions/manager";
import type { Action } from "../../actions/types";

export type CommandPaletteItem = {
  /**
   * Command label. Pass a function to have it resolved lazily on each
   * language change, so labels stay in sync with the active language
   * (see #11569). Plain strings are captured at creation time and won't
   * update when the language changes.
   */
  label: string | (() => string);
  /** additional keywords to match against
   * (appended to haystack, not displayed) */
  keywords?: string[];
  /**
   * string we should match against when searching
   * (deburred name + keywords)
   */
  haystack?: string;
  icon?: Action["icon"];
  category: string;
  order?: number;
  predicate?: boolean | Action["predicate"];
  shortcut?: string | null;
  /** if false, command will not show while in view mode */
  viewMode?: boolean;
  perform: (data: {
    actionManager: ActionManager;
    event: React.MouseEvent | React.KeyboardEvent | KeyboardEvent;
  }) => void;
};

/**
 * A {@link CommandPaletteItem} after its (possibly lazy) `label` has been
 * resolved to a string. Used internally once commands have been built, so
 * the rest of the palette can treat `label` as a plain string.
 */
export type ResolvedCommandPaletteItem = Omit<CommandPaletteItem, "label"> & {
  label: string;
};
