import { createStore, type PrimitiveAtom } from "jotai";
import { createIsolation } from "jotai-scope";
import { useLayoutEffect } from "react";

export const { Provider, useAtom, useAtomValue, useSetAtom, useStore } =
  createIsolation();

export const jotaiStore: ReturnType<typeof createStore> = createStore();

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
