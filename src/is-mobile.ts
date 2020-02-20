import { useState, useEffect } from "react";

const query = window.matchMedia("(max-width: 600px), (max-height: 500px)");

export default function useIsMobile() {
  const [isMobile, setMobile] = useState(query.matches);

  useEffect(() => {
    const handler = () => setMobile(query.matches);
    query.addListener(handler);
    return () => query.removeListener(handler);
  }, []);

  return isMobile;
}
