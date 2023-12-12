import { useEffect } from "react";
import { atom, useAtom } from "jotai";
import throttle from "lodash.throttle";

const scrollPositionAtom = atom<number>(0);

export const useScrollPosition = <T extends HTMLElement>(
  elementRef: React.RefObject<T>,
) => {
  const [scrollPosition, setScrollPosition] = useAtom(scrollPositionAtom);

  useEffect(() => {
    const { current: element } = elementRef;
    if (!element) {
      return;
    }

    const handleScroll = throttle(() => {
      const { scrollTop } = element;
      setScrollPosition(scrollTop);
    }, 200);

    element.addEventListener("scroll", handleScroll);

    return () => {
      handleScroll.cancel();
      element.removeEventListener("scroll", handleScroll);
    };
  }, [elementRef, setScrollPosition]);

  return scrollPosition;
};
