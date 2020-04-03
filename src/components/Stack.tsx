import "./Stack.css";

import React from "react";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "baseline";
  justifyContent?: "center" | "space-around" | "space-between";
};

const RowStack = ({ children, gap, align, justifyContent }: StackProps) => (
  <div
    className="Stack Stack_horizontal"
    style={
      {
        "--gap": gap,
        alignItems: align,
        justifyContent,
      } as React.CSSProperties
    }
  >
    {children}
  </div>
);

const ColStack = ({ children, gap, align, justifyContent }: StackProps) => (
  <div
    className="Stack Stack_vertical"
    style={
      {
        "--gap": gap,
        justifyItems: align,
        justifyContent,
      } as React.CSSProperties
    }
  >
    {children}
  </div>
);

export default {
  Row: RowStack,
  Col: ColStack,
};
