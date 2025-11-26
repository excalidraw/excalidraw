// eslint-disable-next-line no-restricted-imports
import {
  atom,
  createStore,
  type PrimitiveAtom,
  type WritableAtom,
} from "jotai";
import { createIsolation } from "jotai-scope";

// AI Configuration Atoms
import type {
  LLMProvider,
  ModelInfo,
  ConfigurationStatus,
} from "./services/AIConfigurationService";
import type { ConversionStatus } from "./services/ConversionOrchestrationService";

const jotai = createIsolation();

export { atom, PrimitiveAtom, WritableAtom };
export const { useAtom, useSetAtom, useAtomValue, useStore } = jotai;
export const EditorJotaiProvider: ReturnType<
  typeof createIsolation
>["Provider"] = jotai.Provider;

export const editorJotaiStore: ReturnType<typeof createStore> = createStore();

/**
 * AI Configuration Dialog State
 */
export const aiConfigDialogOpenAtom = atom<boolean>(false);

/**
 * Configured LLM Providers
 */
export const aiConfiguredProvidersAtom = atom<LLMProvider[]>([]);

/**
 * Selected LLM Provider
 */
export const aiSelectedProviderAtom = atom<LLMProvider | null>(null);

/**
 * Selected Model
 */
export const aiSelectedModelAtom = atom<ModelInfo | null>(null);

/**
 * Available Models for Selected Provider
 */
export const aiAvailableModelsAtom = atom<ModelInfo[]>([]);

/**
 * AI Configuration Status
 */
export const aiConfigurationStatusAtom = atom<ConfigurationStatus>({
  hasAnyProvider: false,
  configuredProviders: [],
  selectedProvider: undefined,
  selectedModel: undefined,
});

/**
 * Image to Mermaid Dialog State
 */
export const imageToMermaidDialogOpenAtom = atom<boolean>(false);

/**
 * Conversion Progress Status
 */
export const conversionProgressAtom = atom<ConversionStatus | null>(null);

/**
 * Conversion Result (Mermaid Code)
 */
export const conversionResultAtom = atom<string | null>(null);

/**
 * Show Configuration Prompt
 */
export const showConfigPromptAtom = atom<boolean>(false);

/**
 * Conversion Status
 */
export const conversionStatusAtom = atom<ConversionStatus | null>(null);

/**
 * Conversion Error
 */
export const conversionErrorAtom = atom<Error | null>(null);

/**
 * Processing Image (Data URL)
 */
export const processingImageAtom = atom<string | null>(null);
