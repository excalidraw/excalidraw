import App from "./App";

const { StrictMode } = window.React;
//@ts-ignore
const { createRoot } = window.ReactDOM;

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
