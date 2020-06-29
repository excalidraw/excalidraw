import { register } from "./register";
import OpenLibraryButton from "../components/library/OpenLibraryButton";

export const actionOpenLibrary = register({
  name: "openLibrary",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        isLibraryOpen: !appState.isLibraryOpen,
      },
      commitToHistory: false,
    };
  },
  keyTest: (event) => event.key === "b",
  PanelComponent: OpenLibraryButton,
});
