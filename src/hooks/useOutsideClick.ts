import { useEffect, useRef } from "react";

export const useOutsideClickHook = (handler: (event: Event) => void) => {
  const ref = useRef(null);

  useEffect(
    () => {
      const listener = (event: Event) => {
        const current = ref.current as HTMLElement | null;

        // Do nothing if clicking ref's element or descendent elements
        if (
          !current ||
          current.contains(event.target as Node) ||
          [...document.querySelectorAll("[data-prevent-outside-click]")].some(
            (el) => el.contains(event.target as Node),
          )
        ) {
          return;
        }

        handler(event);
      };

      document.addEventListener("pointerdown", listener);
      document.addEventListener("touchstart", listener);
      return () => {
        document.removeEventListener("pointerdown", listener);
        document.removeEventListener("touchstart", listener);
      };
    },
    // Add ref and handler to effect dependencies
    // It's worth noting that because passed in handler is a new ...
    // ... function on every render that will cause this effect ...
    // ... callback/cleanup to run every render. It's not a big deal ...
    // ... but to optimize you can wrap handler in useCallback before ...
    // ... passing it into this hook.
    [ref, handler],
  );

  return ref;
};
