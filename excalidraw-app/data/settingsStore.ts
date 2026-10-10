/**
 * Settings — the single seam through which every operator-configurable endpoint
 * resolves. A component asks this store; it never reads an env literal directly.
 *
 * Storage is **local only** (browser `localStorage`). Nothing here is sent to
 * any host that is not itself a configured endpoint.
 *
 * `feature-0002` — `tickets/open/feature-0002-uw-settings-page-for-agents-and-local-models.md`.
 */

import { normalizeBaseURL } from "./modelProviders";

import type { AgentEndpoint, ModelProvider } from "./modelProviders";

export const SETTINGS_STORAGE_KEY = "excalidraw-team-settings";
export const SETTINGS_VERSION = 1;

export type Settings = {
  version: number;
  models: ModelProvider[];
  agents: AgentEndpoint[];
  /**
   * The collaboration WebSocket server. When unset, collaboration is
   * unavailable rather than defaulting to a hosted service.
   */
  collabServer?: string;
  /**
   * The AI text-to-diagram backend (the bridge in feature-0005). When unset the
   * AI panel renders nothing rather than calling a hosted default.
   */
  aiBackend?: string;
  /**
   * The read-only tickets board (feature-0006). When unset the board has
   * nothing to read from.
   */
  ticketsApi?: string;
  /**
   * The address a ROOM LINK carries — the host the team reaches, when that is
   * not where the operator is sitting. Unset means "this browser", which is
   * honest and never points anyone at a server we do not run.
   */
  publicUrl?: string;
  /**
   * Whether the bridge has a model that can SEE. The diagram-to-code entry is
   * hidden without one, because an offered feature that always errors is worse
   * than an absent one — the bridge serves the same answer at /healthz.
   */
  visionEnabled?: boolean;
};

/** The empty shape — what a migration falls back to, and the local-only state. */
export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  models: [],
  agents: [],
};

/**
 * What a fresh install STARTS with: the empty shape, plus whatever the
 * environment supplied. Seeded once — the moment the operator edits anything,
 * the stored settings win and the environment is never consulted again.
 */
export const initialSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...envDefaults(),
});

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/**
 * What a FRESH install starts with, read from the environment.
 *
 * Nothing here is a real host: these are the operator's own values, supplied per
 * install through `.env.local` (or the build environment), so two machines can
 * point at two different rails without a line of code changing. An unset value
 * means "not configured", which is the local-only state — never a hosted default.
 */
const envDefaults = () => {
  const modelBaseURL = isString(import.meta.env.VITE_APP_MODEL_BASE_URL)
    ? normalizeBaseURL(import.meta.env.VITE_APP_MODEL_BASE_URL)
    : "";
  const model = isString(import.meta.env.VITE_APP_MODEL)
    ? import.meta.env.VITE_APP_MODEL.trim()
    : "";

  // A base URL with no model id is still worth seeding: the operator opens
  // Settings, presses "List models", and picks. That is the intended flow.
  const models: ModelProvider[] = modelBaseURL
    ? [
        {
          id: "from-env",
          kind: "llama.cpp",
          name: "Local llama.cpp (from env)",
          baseURL: modelBaseURL,
          ...(model ? { model } : {}),
        },
      ]
    : [];

  return {
    models,
    ...(isString(import.meta.env.VITE_APP_COLLAB_SERVER)
      ? {
          collabServer: normalizeBaseURL(
            import.meta.env.VITE_APP_COLLAB_SERVER,
          ),
        }
      : {}),
    ...(isString(import.meta.env.VITE_APP_AI_BACKEND)
      ? { aiBackend: normalizeBaseURL(import.meta.env.VITE_APP_AI_BACKEND) }
      : {}),
    ...(isString(import.meta.env.VITE_APP_TICKETS_API)
      ? { ticketsApi: normalizeBaseURL(import.meta.env.VITE_APP_TICKETS_API) }
      : {}),
    ...(isString(import.meta.env.VITE_APP_PUBLIC_URL)
      ? { publicUrl: normalizeBaseURL(import.meta.env.VITE_APP_PUBLIC_URL) }
      : {}),
    ...(import.meta.env.VITE_APP_VISION_ENABLED === "true"
      ? { visionEnabled: true }
      : {}),
  };
};

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

/**
 * Coerces whatever was stored into the current shape. A shape written by an
 * older build must load without throwing, filling missing keys with defaults.
 * An entry that cannot be salvaged is dropped rather than crashing the app.
 */
export const migrateSettings = (input: unknown): Settings => {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = input as Partial<Settings>;

  const models: ModelProvider[] = asArray<ModelProvider>(raw.models)
    .filter(
      (model) =>
        Boolean(model) && isString(model.baseURL) && isString(model.kind),
    )
    .map((model) => ({
      id: isString(model.id) ? model.id : createId(),
      kind: model.kind,
      name: isString(model.name) ? model.name : model.kind,
      baseURL: normalizeBaseURL(model.baseURL),
      // A key round-trips (it must, or the provider stops working) but is never
      // rendered back to the user.
      ...(isString(model.apiKey) ? { apiKey: model.apiKey } : {}),
      ...(isString(model.model) ? { model: model.model } : {}),
      ...(model.shape ? { shape: model.shape } : {}),
    }));

  const agents: AgentEndpoint[] = asArray<AgentEndpoint>(raw.agents)
    .filter((agent) => Boolean(agent) && isString(agent.baseURL))
    .map((agent) => ({
      id: isString(agent.id) ? agent.id : createId(),
      name: isString(agent.name) ? agent.name : "agent",
      baseURL: normalizeBaseURL(agent.baseURL),
    }));

  return {
    version: SETTINGS_VERSION,
    models,
    agents,
    ...(isString(raw.collabServer)
      ? { collabServer: normalizeBaseURL(raw.collabServer) }
      : {}),
    ...(isString(raw.aiBackend)
      ? { aiBackend: normalizeBaseURL(raw.aiBackend) }
      : {}),
    ...(isString(raw.ticketsApi)
      ? { ticketsApi: normalizeBaseURL(raw.ticketsApi) }
      : {}),
    ...(isString(raw.publicUrl)
      ? { publicUrl: normalizeBaseURL(raw.publicUrl) }
      : {}),
    ...(raw.visionEnabled === true ? { visionEnabled: true } : {}),
  };
};

export const createId = (): string => {
  const bytes = new Uint8Array(6);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const loadSettings = (): Settings => {
  if (typeof localStorage === "undefined") {
    return initialSettings();
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      // Nothing stored: this install's environment decides what it starts with.
      return initialSettings();
    }
    return migrateSettings(JSON.parse(raw));
  } catch (error) {
    // A corrupt store must not break the app: fall back to local-only.
    console.warn("Could not read stored settings; using defaults.", error);
    return initialSettings();
  }
};

export const saveSettings = (settings: Settings): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...settings, version: SETTINGS_VERSION }),
    );
  } catch (error) {
    console.warn("Could not persist settings.", error);
  }
};

/** Whether anything at all has been configured. */
export const hasAnyEndpoint = (settings: Settings): boolean =>
  settings.models.length > 0 ||
  settings.agents.length > 0 ||
  Boolean(settings.collabServer) ||
  Boolean(settings.aiBackend) ||
  Boolean(settings.ticketsApi);

/**
 * The public view of a model entry: the API key is **not** included. Use this
 * for anything that could be rendered or exported.
 */
export const redactProvider = (
  provider: ModelProvider,
): Omit<ModelProvider, "apiKey"> & { hasApiKey: boolean } => {
  const { apiKey, ...rest } = provider;
  return { ...rest, hasApiKey: Boolean(apiKey) };
};
