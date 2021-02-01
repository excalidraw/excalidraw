import React, { useState, useEffect, useRef, useContext } from "react";
import variables from "./css/variables.module.scss";

const context = React.createContext(false);

const getIsMobileMatcher = () => {
  return window.matchMedia
    ? window.matchMedia(variables.isMobileQuery)
    : (({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
      } as any) as MediaQueryList);
};

export const IsMobileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const query = useRef<MediaQueryList>();
  if (!query.current) {
    query.current = getIsMobileMatcher();
  }
  const [isMobile, setMobile] = useState(query.current.matches);

  useEffect(() => {
    const handler = () => setMobile(query.current!.matches);
    query.current!.addListener(handler);
    return () => query.current!.removeListener(handler);
  }, []);

  return <context.Provider value={isMobile}>{children}</context.Provider>;
};

export const isMobile = () => getIsMobileMatcher().matches;

export default function useIsMobile() {
  return useContext(context);
}
