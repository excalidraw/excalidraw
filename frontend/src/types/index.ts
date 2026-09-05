export type Role = "user" | "assistant";

/** Image produced by the assistant, rendered inline under its text. */
export interface MessageImage {
  url: string;
  alt?: string;
}

/** File the user hung on a message from the composer's + menu. */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Set while an assistant message is still streaming in. */
  pending?: boolean;
  images?: MessageImage[];
  attachments?: Attachment[];
  /** Excalidraw scene behind a generated diagram, saved as .excalidraw. */
  scene?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

export type SettingsSection =
  | "models"
  | "save-location"
  | "system-instructions"
  | "data-sources";

export interface ChatSettingsValues {
  model: string;
  temperature: number;
  systemPrompt: string;
  apiKey: string;
  savedModels: string[];
  saveLocation: string;
  dataSources: string[];
}

export type Theme = "light" | "dark";

export interface ApiError {
  message: string;
  status: number;
}
