import { useEffect } from "react";
import { atom, useAtom } from "jotai";
import throttle from "lodash.throttle";

const scrollPositionAtom = atom<number>(0);

export const useScrollPosition = <T extends HTMLElement>(
  elementRef: React.RefObject<T>,
) => {
  const [scrollPosition, setScrollPosition] = useAtom(scrollPositionAtom);

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (elementRef.current) {
        const { scrollTop } = elementRef.current;
        setScrollPosition(scrollTop);
      }
    }, 200);

    if (elementRef.current) {
      elementRef.current.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (elementRef.current) {
        elementRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, [elementRef, setScrollPosition]);

  return scrollPosition;
};
