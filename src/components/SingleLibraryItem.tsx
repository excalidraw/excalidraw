import oc from "open-color";
import { useEffect, useRef } from "react";
import { exportToSvg } from "../packages/utils";
import { AppState, LibraryItem } from "../types";

import "./SingleLibraryItem.scss";

const SingleLibraryItem = ({
  elements,
  appState,
}: {
  elements: LibraryItem["elements"];
  appState: AppState;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    (async () => {
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          viewBackgroundColor: oc.white,
          exportBackground: true,
        },
        files: null,
      });
      node.innerHTML = svg.outerHTML;
    })();
  });
  return <div ref={ref} className="single-library-item" />;
};

export default SingleLibraryItem;
