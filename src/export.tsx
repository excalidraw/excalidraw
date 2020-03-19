import React, { useEffect } from "react";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { IsMobileProvider } from "./is-mobile";
import { App } from "./components/App";
import { ComponentProps } from "./types";
import "./styles.scss";

export function Excalidraw(props: ComponentProps) {
  useEffect(() => {
    const disableScale = function(event: Event) {
      // @ts-ignore
      if (event.scale !== 1) {
        event.preventDefault();
      }
    };
    // Block pinch-zooming on iOS outside of the content area
    document.addEventListener("touchmove", disableScale, { passive: false });
    return () => {
      document.removeEventListener("touchmove", disableScale);
    };
  }, []);
  return (
    <TopErrorBoundary>
      <IsMobileProvider>
        <App
          initialState={props.initialState}
          width={props.width}
          height={props.height}
          onChange={props.onChange}
        />
      </IsMobileProvider>
    </TopErrorBoundary>
  );
}
