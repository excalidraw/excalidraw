import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "tldraw/tldraw.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
