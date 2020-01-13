import "./Stack.css";

import React from "react";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end";
};

function RowStack({ children, gap, align }: StackProps) {
  return (
    <div
      className="Stack Stack_horizontal"
      style={{ "--gap": gap, justifyItems: align } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function ColStack({ children, gap, align }: StackProps) {
  return (
    <div
      className="Stack Stack_vertical"
      style={{ "--gap": gap, justifyItems: align } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default {
  Row: RowStack,
  Col: ColStack
};
