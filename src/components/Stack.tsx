import "./Stack.scss";

import React from "react";
import clsx from "clsx";

type StackProps = {
  children: React.ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "baseline";
  justifyContent?: "center" | "space-around" | "space-between";
  className?: string | boolean;
  style?: React.CSSProperties;
};

const RowStack = ({
  children,
  gap,
  align,
  justifyContent,
  className,
  style,
}: StackProps) => {
  return (
    <div
      className={clsx("Stack Stack_horizontal", className)}
      style={{
        "--gap": gap,
        alignItems: align,
        justifyContent,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const ColStack = ({
  children,
  gap,
  align,
  justifyContent,
  className,
}: StackProps) => {
  return (
    <div
      className={clsx("Stack Stack_vertical", className)}
      style={{
        "--gap": gap,
        justifyItems: align,
        justifyContent,
      }}
    >
      {children}
    </div>
  );
};

export default {
  Row: RowStack,
  Col: ColStack,
};
