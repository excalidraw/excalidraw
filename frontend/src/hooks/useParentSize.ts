import { useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks the padding box of an element's parent, so an overlay SVG can be
 * drawn at exactly the size of whatever it is dropped into.
 */
export function useParentSize<T extends Element>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) {
      return;
    }

    const measure = () => {
      setSize((previous) => {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        return previous.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

export default useParentSize;
