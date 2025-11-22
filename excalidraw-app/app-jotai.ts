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

// AI Configuration Atoms moved to packages/excalidraw/editor-jotai.ts

// Re-export AI atoms from editor-jotai for use in app
export {
  aiConfigDialogOpenAtom,
  aiConfiguredProvidersAtom,
  aiSelectedProviderAtom,
  aiSelectedModelAtom,
  aiAvailableModelsAtom,
  aiConfigurationStatusAtom,
  imageToMermaidDialogOpenAtom,
  conversionProgressAtom,
  conversionResultAtom,
  conversionStatusAtom,
  conversionErrorAtom,
  processingImageAtom,
  showConfigPromptAtom,
} from "@excalidraw/excalidraw/editor-jotai";
