// Library menu state shared by dialogs that need to know whether it's open.

import { atom } from "../editor-jotai";

import "./LibraryMenu.scss";

export const isLibraryMenuOpenAtom = atom(false);
