import React, { useEffect } from "react";

import { IsMobileProvider } from "./is-mobile";
import App from "./components/App";

import "./css/styles.scss";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { register as registerServiceWorker } from "./serviceWorker";

const Excalidraw = () => {
  useEffect(() => {
    const handleTouchMove = (event: TouchEvent) => {
      // @ts-ignore
      if (event.scale !== 1) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      // @ts-ignore
      document.removeEventListener("touchMove", handleTouchMove);
    };
  }, []);

  registerServiceWorker();

  return (
    <TopErrorBoundary>
      <IsMobileProvider>
        <App />
      </IsMobileProvider>
    </TopErrorBoundary>
  );
};

export default Excalidraw;
