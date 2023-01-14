import { atom, useAtom } from "jotai";
import React, { useLayoutEffect } from "react";

export const withInternalFallback = <P,>(
  componentName: string,
  Component: React.FC<P>,
) => {
  const counterAtom = atom(0);
  let preferHost = false;

  const WrapperComponent: React.FC<
    P & {
      __fallback?: boolean;
    }
  > = (props) => {
    const [counter, setCounter] = useAtom(counterAtom);

    useLayoutEffect(() => {
      setCounter((counter) => counter + 1);
      return () => {
        setCounter((counter) => counter - 1);
      };
    }, [setCounter]);

    if (!props.__fallback) {
      preferHost = true;
    }

    if (
      (!counter && props.__fallback && preferHost) ||
      (counter > 1 && props.__fallback)
    ) {
      return null;
    }

    return <Component {...props} />;
  };

  WrapperComponent.displayName = componentName;

  return WrapperComponent;
};
