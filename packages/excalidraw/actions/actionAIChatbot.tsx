import { CaptureUpdateAction } from "@excalidraw/element";
import { KEYS } from "@excalidraw/common";
import { ExternalLinkIcon } from "../components/icons";
import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";
import { t } from "../i18n";
import { register } from "./register";

export const actionAIChatbot = register({
  name: "aiChatbot",
  label: "AI Assistant",
  icon: ExternalLinkIcon,
  viewMode: true,
  trackEvent: { category: "menu", action: "ai_chatbot" },
  keyTest: (event) => event.key === KEYS.C && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey,
  keywords: ["ai", "assistant", "chat", "help", "create", "generate"],
  perform: (elements, appState, _, app) => {
    // Check if the global toggle function exists (set by AIComponents)
    if (typeof (window as any).toggleAIChatbot === "function") {
      (window as any).toggleAIChatbot();
    } else {
      console.warn("AI Chatbot is not available");
    }

    return {
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  predicate: () => true, // Always available
}); 