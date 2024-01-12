"use client";

import { Excalidraw } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

export default function Home() {
  return (
    <div style={{ height: "800px", margin: "40px" }}>
      <Excalidraw />
    </div>
  );
}
