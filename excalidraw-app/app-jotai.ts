// eslint-disable-next-line no-restricted-imports
import {
  atom,
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom,
  createStore,
  type PrimitiveAtom,
} from "jotai";
import { useLayoutEffect } from "react";

export const appJotaiStore = createStore();

export { atom, Provider, useAtom, useAtomValue, useSetAtom };

export const useAtomWithInitialValue = <
  T extends unknown,
  A extends PrimitiveAtom<T>,
>(
  atom: A,
  initialValue: T | (() => T),
) => {
  const [value, setValue] = useAtom(atom);

  useLayoutEffect(() => {
    if (typeof initialValue === "function") {
      // @ts-ignore
      setValue(initialValue());
    } else {
      setValue(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [value, setValue] as const;
};

// AI Configuration Atoms
import type { LLMProvider, ModelInfo, ConfigurationStatus } from "../packages/excalidraw/services/AIConfigurationService";
import type { ConversionStatus } from "../packages/excalidraw/services/ConversionOrchestrationService";

/**
 * AI Configuration Dialog State
 */
export const aiConfigDialogOpenAtom = atom<boolean>(false);

/**
 * Configured AI Providers
 */
export const aiConfiguredProvidersAtom = atom<LLMProvider[]>([]);

/**
 * Selected AI Provider
 */
export const aiSelectedProviderAtom = atom<LLMProvider | null>(null);

/**
 * Selected Model ID
 */
export const aiSelectedModelAtom = atom<string | null>(null);

/**
 * Available Models for Current Provider
 */
export const aiAvailableModelsAtom = atom<ModelInfo[]>([]);

/**
 * AI Configuration Status
 */
export const aiConfigurationStatusAtom = atom<ConfigurationStatus | null>(null);

/**
 * Image to Mermaid Dialog State
 */
export const imageToMermaidDialogOpenAtom = atom<boolean>(false);

/**
 * Conversion Progress State
 */
export const conversionProgressAtom = atom<ConversionStatus | null>(null);

/**
 * Conversion Result (Mermaid Code)
 */
export const conversionResultAtom = atom<string | null>(null);

/**
 * Conversion Error State
 */
export const conversionErrorAtom = atom<Error | null>(null);

/**
 * Currently Processing Image
 */
export const processingImageAtom = atom<string | null>(null); // Data URL

/**
 * Show Configuration Prompt (when no provider configured)
 */
export const showConfigPromptAtom = atom<boolean>(false);
