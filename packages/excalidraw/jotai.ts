import type { PrimitiveAtom } from "jotai";
import { unstable_createStore, useAtom } from "jotai";
import { useLayoutEffect } from "react";

export const jotaiScope = Symbol();
export const jotaiStore = unstable_createStore();

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
