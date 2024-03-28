import { actionToggleTheme } from "../../actions";
import { CommandPaletteItem } from "./types";

export const toggleTheme: CommandPaletteItem = {
  ...actionToggleTheme,
  category: "Editor",
  label: "Toggle theme",
  perform: ({ actionManager }) => {
    actionManager.executeAction(actionToggleTheme, "commandPalette");
  },
};
