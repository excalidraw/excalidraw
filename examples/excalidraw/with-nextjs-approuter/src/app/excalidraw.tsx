"use client";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

const Excalidraw: any = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
  },
);
const ExcalidrawWithClientOnly = () => {
  return (
    <div style={{ height: "800px", margin: "40px" }}>
      <Excalidraw />
    </div>
  );
};

export default ExcalidrawWithClientOnly;
