import "./Stack.css";

import React from "react";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "baseline";
  justifyContent?: "center" | "space-around" | "space-between";
  className?: string | boolean;
};

function RowStack({
  children,
  gap,
  align,
  justifyContent,
  className,
}: StackProps) {
  return (
    <div
      className={`Stack Stack_horizontal ${className || ""}`}
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
}

function ColStack({
  children,
  gap,
  align,
  justifyContent,
  className,
}: StackProps) {
  return (
    <div
      className={`Stack Stack_vertical ${className || ""}`}
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
}

export default {
  Row: RowStack,
  Col: ColStack,
};
