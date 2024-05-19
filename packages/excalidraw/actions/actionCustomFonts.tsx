import { register } from "./register";
import { StoreAction } from '../store'; 


export const actionCustomFonts = register({
  name: "customFonts",
  label: "CustomFonts",
  viewMode: true,
  trackEvent: { category: "customfonts" },
  perform: async (elements, appState, value, app) => {
    return {
      commitToHistory: false,
      appState: {
        ...appState,
        openDialog: { name: "customFonts" },
      },
      storeAction: StoreAction.NONE
    };
  },
});
