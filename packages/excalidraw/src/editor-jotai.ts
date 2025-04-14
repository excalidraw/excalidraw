// eslint-disable-next-line no-restricted-imports
import { atom, createStore, type PrimitiveAtom } from "jotai";
import { createIsolation } from "jotai-scope";

const jotai = createIsolation();

export { atom, PrimitiveAtom };
export const { useAtom, useSetAtom, useAtomValue, useStore } = jotai;
export const EditorJotaiProvider: ReturnType<
  typeof createIsolation
>["Provider"] = jotai.Provider;

export const editorJotaiStore: ReturnType<typeof createStore> = createStore();
