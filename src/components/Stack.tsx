import "./Stack.css";

import React from "react";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
};

function RowStack({ children, gap }: StackProps) {
  return (
    <div
      className="Stack Stack_horizontal"
      style={{ "--gap": gap } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function ColStack({ children, gap }: StackProps) {
  return (
    <div
      className="Stack Stack_vertical"
      style={{ "--gap": gap } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default {
  Row: RowStack,
  Col: ColStack
};
