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

/**
 * Multiproject state. The structural type is declared inline (instead of
 * importing ProjectIndexEntry from data/projectsStore) to keep this module
 * dependency-free and avoid import cycles.
 */
export const projectsListAtom = atom<
  { id: string; title: string; updatedAt: number }[]
>([]);
export const activeProjectIdAtom = atom<string | null>(null);

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
