import type { ReactElement } from "react";
import type { Root } from "react-dom/client";
import { createElement } from "react";

import { getAuthShellConfig } from "./config";

type AppFactory = () => ReactElement;

function AuthShellLoader() {
  return createElement(
    "div",
    {
      style: {
        alignItems: "center",
        display: "flex",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "1rem",
        height: "100vh",
        justifyContent: "center",
        padding: "2rem",
      },
    },
    "Preparing authentication…",
  );
}

export function renderWithAuth(root: Root, createApp: AppFactory): void {
  const config = getAuthShellConfig();

  if (!config.enabled) {
    root.render(createApp());
    return;
  }

  root.render(createElement(AuthShellLoader));

  import("./AuthGate")
    .then(({ AuthGate }) => {
      root.render(
        createElement(AuthGate, { config, children: createApp() }),
      );
    })
    .catch((error) => {
      console.error("[AuthShell] Failed to load auth shell, rendering app", error);
      root.render(createApp());
    });
}
