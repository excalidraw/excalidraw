import { useEffect } from "react";
import { atom, useAtom } from "jotai";
import throttle from "lodash.throttle";

const scrollPositionAtom = atom<number>(0);

export const useScrollPosition = <T extends HTMLElement>(
  elementRef: React.RefObject<T>,
) => {
  const [scrollPosition, setScrollPosition] = useAtom(scrollPositionAtom);
  const { current: element } = elementRef;

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (element) {
        const { scrollTop } = element;
        setScrollPosition(scrollTop);
      }
    }, 200);

    if (element) {
      element.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (element) {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }, [element, setScrollPosition]);

  return scrollPosition;
};
