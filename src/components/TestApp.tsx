import React from "react";
import { Canvas } from "./Canvas";
import { Rectangle } from "./Rectangle";

export function TestApp() {
  return (
    <Canvas
      width={window.innerWidth}
      height={window.innerHeight - 4}
      backgroundColor="#eeeeee"
    >
      <Rectangle
        x={10}
        y={10}
        width={50}
        height={20}
        onTap={() => alert("Clicked on rect 1")}
        strokeColor="blue"
      />
      <Rectangle
        x={70}
        y={20}
        width={30}
        height={40}
        onHover={() => alert("Hovered over rect 2")}
        fillColor="red"
      />
    </Canvas>
  );
}
