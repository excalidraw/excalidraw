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

// Google Drive integration atoms
export const googleDriveAuthAtom = atom<{
  isAuthenticated: boolean;
  accessToken: string | null;
  userEmail: string | null;
}>({
  isAuthenticated: false,
  accessToken: null,
  userEmail: null,
});

export const currentBoardIdAtom = atom<string | null>(null);

export const boardsListAtom = atom<
  Array<{ id: string; name: string; folderId: string }>
>([]);

export const excalidrawFolderIdAtom = atom<string | null>(null);
