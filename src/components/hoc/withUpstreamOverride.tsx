import React, {
  useMemo,
  useContext,
  useLayoutEffect,
  useState,
  createContext,
} from "react";

export const withUpstreamOverride = <P,>(Component: React.ComponentType<P>) => {
  type ContextValue = [boolean, React.Dispatch<React.SetStateAction<boolean>>];

  const DefaultComponentContext = createContext<ContextValue>([
    false,
    () => {},
  ]);

  const ComponentContext: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => {
    const [isRenderedUpstream, setIsRenderedUpstream] = useState(false);
    const contextValue: ContextValue = useMemo(
      () => [isRenderedUpstream, setIsRenderedUpstream],
      [isRenderedUpstream],
    );

    return (
      <DefaultComponentContext.Provider value={contextValue}>
        {children}
      </DefaultComponentContext.Provider>
    );
  };

  const DefaultComponent = (
    props: P & {
      // indicates whether component should render when not rendered upstream
      /** @private internal */
      __isFallback?: boolean;
    },
  ) => {
    const [isRenderedUpstream, setIsRenderedUpstream] = useContext(
      DefaultComponentContext,
    );

    useLayoutEffect(() => {
      if (!props.__isFallback) {
        setIsRenderedUpstream(true);
        return () => setIsRenderedUpstream(false);
      }
    }, [props.__isFallback, setIsRenderedUpstream]);

    if (props.__isFallback && isRenderedUpstream) {
      return null;
    }

    return <Component {...props} />;
  };
  if (Component.name) {
    DefaultComponent.displayName = `${Component.name}_upstreamOverrideWrapper`;
    ComponentContext.displayName = `${Component.name}_upstreamOverrideContextWrapper`;
  }

  return [ComponentContext, DefaultComponent] as const;
};
