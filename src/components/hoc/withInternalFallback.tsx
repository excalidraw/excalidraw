import { atom, useAtom } from "jotai";
import React, { useLayoutEffect } from "react";
import { useTunnels } from "../context/tunnels";

export const withInternalFallback = <P,>(
  componentName: string,
  Component: React.FC<P>,
) => {
  const counterAtom = atom(0);
  // flag set on initial render to tell the fallback component to skip the
  // render until mount counter are initialized. This is because the counter
  // is initialized in an effect, and thus we could end rendering both
  // components at the same time until counter is initialized.
  let preferHost = false;

  const WrapperComponent: React.FC<
    P & {
      __fallback?: boolean;
    }
  > = (props) => {
    const { jotaiScope } = useTunnels();
    const [counter, setCounter] = useAtom(counterAtom, jotaiScope);

    useLayoutEffect(() => {
      setCounter((counter) => counter + 1);
      return () => {
        setCounter((counter) => counter - 1);
      };
    }, [setCounter]);

    if (!props.__fallback) {
      preferHost = true;
    }

    // ensure we don't render fallback and host components at the same time
    if (
      // either before the counters are initialized
      (!counter && props.__fallback && preferHost) ||
      // or after the counters are initialized, and both are rendered
      // (this is the default when host renders as well)
      (counter > 1 && props.__fallback)
    ) {
      return null;
    }

    return <Component {...props} />;
  };

  WrapperComponent.displayName = componentName;

  return WrapperComponent;
};
