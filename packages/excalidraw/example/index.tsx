const { StrictMode } = window.React;
const { createRoot } = window.ReactDOM;

import App from "./App";

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App
      appTitle={"Excalidraw Example"}
      useCustom={(api: any, args?: any[]) => {}}
    />
  </StrictMode>,
);
