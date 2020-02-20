import React, { useState, useEffect, useRef, useContext } from "react";

const context = React.createContext(false);

export function IsMobileProvider({ children }: { children: React.ReactNode }) {
  const query = useRef<MediaQueryList>();
  if (!query.current) {
    query.current = window.matchMedia(
      "(max-width: 600px), (max-height: 500px)",
    );
  }
  const [isMobile, setMobile] = useState(query.current.matches);

  useEffect(() => {
    const handler = () => setMobile(query.current!.matches);
    query.current!.addListener(handler);
    return () => query.current!.removeListener(handler);
  }, []);

  return <context.Provider value={isMobile}>{children}</context.Provider>;
}

export default function useIsMobile() {
  return useContext(context);
}
