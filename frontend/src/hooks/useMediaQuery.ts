import { useEffect, useState } from "react";

/** Reads a media query and re-renders when it flips. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => globalThis.matchMedia?.(query).matches ?? false,
  );

  useEffect(() => {
    const list = globalThis.matchMedia?.(query);
    if (!list) {
      return;
    }

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
